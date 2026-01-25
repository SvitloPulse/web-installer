#!/usr/bin/env python
#
# esp-idf NVS partition generation tool. Tool helps in generating NVS-compatible
# partition binary, with key-value pair entries provided via a CSV file.
#
# SPDX-FileCopyrightText: 2018-2023 Espressif Systems (Shanghai) CO LTD
# SPDX-License-Identifier: Apache-2.0
#

import array
import binascii
import codecs
import os
import struct
import sys
import textwrap
import zlib
from io import open


VERSION1_PRINT = 'V1 - Multipage Blob Support Disabled'
VERSION2_PRINT = 'V2 - Multipage Blob Support Enabled'


def reverse_hexbytes(addr_tmp):
    addr = []
    reversed_bytes = ''
    for i in range(0, len(addr_tmp), 2):
        addr.append(addr_tmp[i:i + 2])
    reversed_bytes = ''.join(reversed(addr))

    return reversed_bytes


def desc_format(*args):
    desc = ''
    for arg in args:
        desc += textwrap.fill(replace_whitespace=False, text=arg) + '\n'
    return desc


""" Class for standard NVS page structure """


class Page(object):
    # Item type codes
    U8   = 0x01
    I8   = 0x11
    U16  = 0x02
    I16  = 0x12
    U32  = 0x04
    I32  = 0x14
    U64  = 0x08
    I64  = 0x18
    SZ   = 0x21
    BLOB = 0x41
    BLOB_DATA = 0x42
    BLOB_IDX = 0x48

    # Few Page constants
    HEADER_SIZE = 32
    BITMAPARRAY_OFFSET = 32
    BITMAPARRAY_SIZE_IN_BYTES = 32
    FIRST_ENTRY_OFFSET = 64
    SINGLE_ENTRY_SIZE = 32
    CHUNK_ANY = 0xFF
    ACTIVE = 0xFFFFFFFE
    FULL = 0xFFFFFFFC
    VERSION1 = 0xFF
    VERSION2 = 0xFE

    PAGE_PARAMS = {
        'max_size': 4096,
        'max_blob_size': {VERSION1: 1984, VERSION2: 4000},
        'max_entries': 126
    }

    def __init__(self, page_num, version, is_rsrv_page=False):
        self.entry_num = 0
        self.bitmap_array = array.array('B')
        self.version = version
        self.page_buf = bytearray(b'\xff') * Page.PAGE_PARAMS['max_size']
        if not is_rsrv_page:
            self.bitmap_array = self.create_bitmap_array()
            self.set_header(page_num, version)

    def set_header(self, page_num, version):
        # set page state to active
        page_header = bytearray(b'\xff') * 32
        page_state_active_seq = Page.ACTIVE
        struct.pack_into('<I', page_header, 0,  page_state_active_seq)
        # set page sequence number
        struct.pack_into('<I', page_header, 4, page_num)
        # set version
        if version == Page.VERSION2:
            page_header[8] = Page.VERSION2
        elif version == Page.VERSION1:
            page_header[8] = Page.VERSION1
        # set header's CRC
        crc_data = bytes(page_header[4:28])
        crc = zlib.crc32(crc_data, 0xFFFFFFFF)
        struct.pack_into('<I', page_header, 28, crc & 0xFFFFFFFF)
        self.page_buf[0:len(page_header)] = page_header

    def create_bitmap_array(self):
        bitarray = array.array('B')
        charsize = 32  # bitmaparray has 256 bits, hence 32 bytes
        fill = 255  # Fill all 8 bits with 1's
        bitarray.extend((fill,) * charsize)
        return bitarray

    def write_bitmaparray(self):
        bitnum = self.entry_num * 2
        byte_idx = bitnum // 8  # Find byte index in the array
        bit_offset = bitnum & 7  # Find bit offset in given byte index
        mask = ~(1 << bit_offset)
        self.bitmap_array[byte_idx] &= mask
        start_idx = Page.BITMAPARRAY_OFFSET
        end_idx = Page.BITMAPARRAY_OFFSET + Page.BITMAPARRAY_SIZE_IN_BYTES
        self.page_buf[start_idx:end_idx] = self.bitmap_array


    def write_entry_to_buf(self, data, entrycount,nvs_obj):
        encr_data = bytearray()

        data_offset = Page.FIRST_ENTRY_OFFSET + (Page.SINGLE_ENTRY_SIZE * self.entry_num)
        start_idx = data_offset
        end_idx = data_offset + len(data)
        self.page_buf[start_idx:end_idx]  = data

        # Set bitmap array for entries in current page
        for i in range(0, entrycount):
            self.write_bitmaparray()
            self.entry_num += 1

    def set_crc_header(self, entry_struct):
        crc_data = bytearray(b'28')
        crc_data[0:4] = entry_struct[0:4]
        crc_data[4:28] = entry_struct[8:32]
        crc_data = bytes(crc_data)
        crc = zlib.crc32(crc_data, 0xFFFFFFFF)
        struct.pack_into('<I', entry_struct, 4, crc & 0xFFFFFFFF)
        return entry_struct

    def write_varlen_binary_data(self, 
                                entry_struct, 
                                ns_index, 
                                key, 
                                data, 
                                data_size, 
                                total_entry_count, 
                                encoding, 
                                nvs_obj):
        chunk_start = 0
        chunk_count = 0
        chunk_index = Page.CHUNK_ANY
        offset = 0
        remaining_size = data_size
        tailroom = None

        while True:
            chunk_size = 0

            # Get the size available in current page
            tailroom = (Page.PAGE_PARAMS['max_entries'] - self.entry_num - 1) * Page.SINGLE_ENTRY_SIZE
            assert tailroom >= 0, 'Page overflow!!'

            # Split the binary data into two and store a chunk of available size onto curr page
            if tailroom < remaining_size:
                chunk_size = tailroom
            else:
                chunk_size = remaining_size

            remaining_size = remaining_size - chunk_size

            # Change type of data to BLOB_DATA
            entry_struct[1] = Page.BLOB_DATA

            # Calculate no. of entries data chunk will require
            datachunk_rounded_size = (chunk_size + 31) & ~31
            datachunk_entry_count = datachunk_rounded_size // 32
            datachunk_total_entry_count = datachunk_entry_count + 1  # +1 for the entry header

            # Set Span
            entry_struct[2] = datachunk_total_entry_count

            # Update the chunkIndex
            chunk_index = chunk_start + chunk_count
            entry_struct[3] = chunk_index

            # Set data chunk
            data_chunk = data[offset:offset + chunk_size]

            # Compute CRC of data chunk
            struct.pack_into('<H', entry_struct, 24, chunk_size)

            if type(data) != bytes:
                data_chunk = bytes(data_chunk, encoding='utf8')

            crc = zlib.crc32(data_chunk, 0xFFFFFFFF)
            struct.pack_into('<I', entry_struct, 28, crc & 0xFFFFFFFF)

            # compute crc of entry header
            entry_struct = self.set_crc_header(entry_struct)

            # write entry header
            self.write_entry_to_buf(entry_struct, 1,nvs_obj)
            # write actual data
            self.write_entry_to_buf(data_chunk, datachunk_entry_count,nvs_obj)

            chunk_count = chunk_count + 1

            if remaining_size or (tailroom - chunk_size) < Page.SINGLE_ENTRY_SIZE:
                nvs_obj.create_new_page()
                self = nvs_obj.cur_page

            offset = offset + chunk_size

            # All chunks are stored, now store the index
            if not remaining_size:
                # Initialise data field to 0xff
                data_array = bytearray(b'\xff') * 8
                entry_struct[24:32] = data_array

                # change type of data to BLOB_IDX
                entry_struct[1] = Page.BLOB_IDX

                # Set Span
                entry_struct[2] = 1

                # Update the chunkIndex
                chunk_index = Page.CHUNK_ANY
                entry_struct[3] = chunk_index

                struct.pack_into('<I', entry_struct, 24, data_size)
                entry_struct[28] = chunk_count
                entry_struct[29] = chunk_start

                # compute crc of entry header
                entry_struct = self.set_crc_header(entry_struct)

                # write last entry
                self.write_entry_to_buf(entry_struct, 1,nvs_obj)
                break

        return entry_struct

    def write_single_page_entry(self, entry_struct, data, datalen, data_entry_count, nvs_obj):
        # compute CRC of data
        struct.pack_into('<H', entry_struct, 24, datalen)

        if type(data) != bytes:
            data = bytes(data, encoding='utf8')

        crc = zlib.crc32(data, 0xFFFFFFFF)
        struct.pack_into('<I', entry_struct, 28, crc & 0xFFFFFFFF)

        # compute crc of entry header
        entry_struct = self.set_crc_header(entry_struct)

        # write entry header
        self.write_entry_to_buf(entry_struct, 1, nvs_obj)
        # write actual data
        self.write_entry_to_buf(data, data_entry_count, nvs_obj)

    """
    Low-level function to write variable length data into page buffer. Data should be formatted
    according to encoding specified.
    """
    def write_varlen_data(self, key, data, encoding, ns_index,nvs_obj):
        # Set size of data
        datalen = len(data)

        max_blob_size = Page.PAGE_PARAMS['max_blob_size'][self.version]
        # V2 blob size limit only applies to strings
        blob_limit_applies = self.version == Page.VERSION1 or encoding == 'string'

        if blob_limit_applies and datalen > max_blob_size:
            raise InputError(' Input File: Size (%d) exceeds max allowed length `%s` bytes for key `%s`.'
                             % (datalen, max_blob_size, key))

        # Calculate no. of entries data will require
        rounded_size = (datalen + 31) & ~31
        data_entry_count = rounded_size // 32
        total_entry_count = data_entry_count + 1  # +1 for the entry header

        # Check if page is already full and new page is needed to be created right away
        if self.entry_num >= Page.PAGE_PARAMS['max_entries']:
            raise PageFullError()
        elif (self.entry_num + total_entry_count) >= Page.PAGE_PARAMS['max_entries']:
            if not (self.version == Page.VERSION2 and encoding in ['hex2bin', 'binary', 'base64']):
                raise PageFullError()

        # Entry header
        entry_struct = bytearray(b'\xff') * 32
        # Set Namespace Index
        entry_struct[0] = ns_index
        # Set Span
        if self.version == Page.VERSION2:
            if encoding == 'string':
                entry_struct[2] = data_entry_count + 1
            # Set Chunk Index
            chunk_index = Page.CHUNK_ANY
            entry_struct[3] = chunk_index
        else:
            entry_struct[2] = data_entry_count + 1

        # set key
        key_array = b'\x00' * 16
        entry_struct[8:24] = key_array
        entry_struct[8:8 + len(key)] = key.encode()

        # set Type
        if encoding == 'string':
            entry_struct[1] = Page.SZ
        elif encoding in ['hex2bin', 'binary', 'base64']:
            entry_struct[1] = Page.BLOB

        if self.version == Page.VERSION2 and (encoding in ['hex2bin', 'binary', 'base64']):
            entry_struct = self.write_varlen_binary_data(entry_struct,ns_index,key,data,
                                                         datalen,total_entry_count, encoding, nvs_obj)
        else:
            self.write_single_page_entry(entry_struct, data, datalen, data_entry_count, nvs_obj)

    """ Low-level function to write data of primitive type into page buffer. """
    def write_primitive_data(self, key, data, encoding, ns_index,nvs_obj):
        # Check if entry exceeds max number of entries allowed per page
        if self.entry_num >= Page.PAGE_PARAMS['max_entries']:
            raise PageFullError()

        entry_struct = bytearray(b'\xff') * 32
        entry_struct[0] = ns_index  # namespace index
        entry_struct[2] = 0x01  # Span
        chunk_index = Page.CHUNK_ANY
        entry_struct[3] = chunk_index

        # write key
        key_array = b'\x00' * 16
        entry_struct[8:24] = key_array
        entry_struct[8:8 + len(key)] = key.encode()

        if encoding == 'u8':
            entry_struct[1] = Page.U8
            struct.pack_into('<B', entry_struct, 24, data)
        elif encoding == 'i8':
            entry_struct[1] = Page.I8
            struct.pack_into('<b', entry_struct, 24, data)
        elif encoding == 'u16':
            entry_struct[1] = Page.U16
            struct.pack_into('<H', entry_struct, 24, data)
        elif encoding == 'i16':
            entry_struct[1] = Page.I16
            struct.pack_into('<h', entry_struct, 24, data)
        elif encoding == 'u32':
            entry_struct[1] = Page.U32
            struct.pack_into('<I', entry_struct, 24, data)
        elif encoding == 'i32':
            entry_struct[1] = Page.I32
            struct.pack_into('<i', entry_struct, 24, data)
        elif encoding == 'u64':
            entry_struct[1] = Page.U64
            struct.pack_into('<Q', entry_struct, 24, data)
        elif encoding == 'i64':
            entry_struct[1] = Page.I64
            struct.pack_into('<q', entry_struct, 24, data)

        # Compute CRC
        crc_data = bytearray(b'28')
        crc_data[0:4] = entry_struct[0:4]
        crc_data[4:28] = entry_struct[8:32]
        crc_data = bytes(crc_data)
        crc = zlib.crc32(crc_data, 0xFFFFFFFF)
        struct.pack_into('<I', entry_struct, 4, crc & 0xFFFFFFFF)

        # write to file
        self.write_entry_to_buf(entry_struct, 1,nvs_obj)

    """ Get page buffer data of a given page """
    def get_data(self):
        return self.page_buf


"""
NVS class encapsulates all NVS specific operations to create a binary with given key-value pairs.
Binary can later be flashed onto device via a flashing utility.
"""


class NVS(object):
    def __init__(self, fout, input_size, version, encrypt=False, key_input=None):
        self.size = input_size
        self.encrypt = encrypt
        self.encr_key = None
        self.namespace_idx = 0
        self.page_num = -1
        self.pages = []
        self.version = version
        self.fout = fout
        if self.encrypt:
            self.encr_key = key_input
        self.cur_page = self.create_new_page(version)

    def __enter__(self):
        return self
    
    def finalize(self):
        # Create pages for remaining available size
        while True:
            try:
                self.create_new_page()
            except InsufficientSizeError:
                self.size = None
                # Creating the last reserved page
                self.create_new_page(is_rsrv_page=True)
                break
        return self.get_binary_data()

    def __exit__(self, exc_type, exc_value, traceback):
        if exc_type is None and exc_value is None:
            # Create pages for remaining available size
            while True:
                try:
                    self.create_new_page()
                except InsufficientSizeError:
                    self.size = None
                    # Creating the last reserved page
                    self.create_new_page(is_rsrv_page=True)
                    break
            result = self.get_binary_data()
            self.fout.write(result)

    def create_new_page(self, version=None, is_rsrv_page=False):
        # Set previous page state to FULL before creating new page
        if self.pages:
            curr_page_state = struct.unpack('<I', self.cur_page.page_buf[0:4])[0]
            if curr_page_state == Page.ACTIVE:
                page_state_full_seq = Page.FULL
                struct.pack_into('<I', self.cur_page.page_buf, 0, page_state_full_seq)
        # Set version for NVS binary generated
        version = self.version
        # Update available size as each page is created
        if self.size == 0:
            raise InsufficientSizeError(
                'Error: Size parameter is less than the size of data in csv.Please increase size.')
        if not is_rsrv_page:
            self.size = self.size - Page.PAGE_PARAMS['max_size']
        self.page_num += 1
        # Set version for each page and page header
        new_page = Page(self.page_num, version, is_rsrv_page)
        self.pages.append(new_page)
        self.cur_page = new_page
        return new_page

    """
    Write namespace entry and subsequently increase namespace count so that all upcoming entries
    will be mapped to a new namespace.
    """
    def write_namespace(self, key):
        self.namespace_idx += 1
        try:
            self.cur_page.write_primitive_data(key, self.namespace_idx, 'u8', 0,self)
        except PageFullError:
            new_page = self.create_new_page()
            new_page.write_primitive_data(key, self.namespace_idx, 'u8', 0,self)

    """
    Write key-value pair. Function accepts value in the form of ascii character and converts
    it into appropriate format before calling Page class's functions to write entry into NVS format.
    Function handles PageFullError and creates a new page and re-invokes the function on a new page.
    We don't have to guard re-invocation with try-except since no entry can span multiple pages.
    """
    def write_entry(self, key, value, encoding):
        # Encoding-specific handling
        if encoding == 'hex2bin':
            value = value.strip()
            if len(value) % 2 != 0:
                raise InputError('%s: Invalid data length. Should be multiple of 2.' % key)
            value = binascii.a2b_hex(value)
        elif encoding == 'base64':
            value = binascii.a2b_base64(value)
        elif encoding == 'string':
            if type(value) == bytes:
                value = value.decode()
            value += '\0'

        encoding = encoding.lower()
        varlen_encodings = {'string', 'binary', 'hex2bin', 'base64'}
        primitive_encodings = {'u8', 'i8', 'u16', 'i16', 'u32', 'i32', 'u64', 'i64'}

        if encoding in varlen_encodings:
            try:
                self.cur_page.write_varlen_data(key, value, encoding, self.namespace_idx,self)
            except PageFullError:
                new_page = self.create_new_page()
                new_page.write_varlen_data(key, value, encoding, self.namespace_idx,self)
        elif encoding in primitive_encodings:
            try:
                self.cur_page.write_primitive_data(key, int(value), encoding, self.namespace_idx,self)
            except PageFullError:
                new_page = self.create_new_page()
                new_page.write_primitive_data(key, int(value), encoding, self.namespace_idx,self)
        else:
            raise InputError('%s: Unsupported encoding' % encoding)

    """ Return accumulated data of all pages """
    def get_binary_data(self):
        data = bytearray()
        for page in self.pages:
            data += page.get_data()
        return data


class PageFullError(RuntimeError):
    """
    Represents error when current page doesn't have sufficient entries left
    to accommodate current request
    """
    def __init__(self):
        super(PageFullError, self).__init__()


class InputError(RuntimeError):
    """
    Represents error on the input
    """
    def __init__(self, e):
        print('\nError:')
        super(InputError, self).__init__(e)


class InsufficientSizeError(RuntimeError):
    """
    Represents error when NVS Partition size given is insufficient
    to accomodate the data in the given csv file
    """
    def __init__(self, e):
        super(InsufficientSizeError, self).__init__(e)


def nvs_open(result_obj, input_size, version=None, is_encrypt=False, key=None):
    """ Wrapper to create and NVS class object. This object can later be used to set key-value pairs

    :param result_obj: File/Stream object to dump resultant binary. 
                        If data is to be dumped into memory, one way is to use BytesIO object
    :param input_size: Size of Partition
    :return: NVS class instance
    """
    return NVS(result_obj, input_size, version, encrypt=is_encrypt, key_input=key)


def write_entry(nvs_instance, key, datatype, encoding, value):
    """ Wrapper to set key-value pair in NVS format

    :param nvs_instance: Instance of an NVS class returned by nvs_open()
    :param key: Key of the data
    :param datatype: Data type. Valid values are "file", "data" and "namespace"
    :param encoding: Data encoding. Valid values are "u8", "i8", "u16", "i16", "u32", "i32", "u64", "i64", 
                        "string", "binary", "hex2bin" and "base64"
    :param value: Data value in ascii encoded string format for "data" datatype and filepath for "file" datatype
    :return: None
    """

    if datatype == 'file':
        abs_file_path = value
        if os.path.isabs(value) is False:
            script_dir = os.getcwd()
            abs_file_path = os.path.join(script_dir, value)

        with open(abs_file_path, 'rb') as f:
            value = f.read()

    if datatype == 'namespace':
        nvs_instance.write_namespace(key)
    else:
        nvs_instance.write_entry(key, value, encoding)


def nvs_close(nvs_instance):
    """ Wrapper to finish writing to NVS and write data to file/stream object provided to nvs_open method

    :param nvs_instance: Instance of NVS class returned by nvs_open()
    :return: None
    """
    nvs_instance.__exit__(None, None, None)


def check_size(size):
    '''
    Checks for input partition size
    :param size: Input partition size
    '''
    input_size = size
    try:
        # Set size
        if input_size % 4096 != 0:
            sys.exit('Size of partition must be multiple of 4096')

        # Update size as a page needs to be reserved of size 4KB
        input_size = input_size - Page.PAGE_PARAMS['max_size']

        if input_size < (2 * Page.PAGE_PARAMS['max_size']):
            sys.exit('Minimum NVS partition size needed is 0x3000 bytes.')
        return input_size
    except Exception as e:
        print(e)
        sys.exit(0)


def create_nvs_bin(args: dict):
    # Accept Pyodide JsProxy and convert to Python dict if needed
    if hasattr(args, "to_py"):
        args = args.to_py()
    ssid = args['ssid']
    paswd = args['password']
    sb_cfg = args.get('sb_cfg', {})
    # Calculate the length of the SSID
    ssid_length = len(ssid)
    # Pack the length as a little-endian unsigned integer, and then append the SSID as bytes
    ssid_serialized = struct.pack('<I', ssid_length) + ssid.encode('utf-8')

    nvs = NVS(None, check_size(0x6000), Page.VERSION2)
    nvs.write_namespace('nvs.net80211')
    nvs.write_entry('sta.ssid', ssid_serialized, 'binary')
    nvs.write_entry('sta.pswd', paswd, 'binary')
    nvs.write_namespace('sb_cfg')
    for key, entry in sb_cfg.items():
        nvs.write_entry(key, entry['value'], entry['type'])
    return nvs.finalize()
            