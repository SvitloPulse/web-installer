import { useEffect, useState } from "react";

interface BootstrapProps {
    children?: React.ReactNode;
}

export const Bootstrap: React.FC<BootstrapProps> = (props) => {
    const [bootstrapped, setBootstrapped] = useState(false);

    useEffect(() => {
        async function _doBootstrap() {
            setBootstrapped(true);
        }
        _doBootstrap();
    }, []);

    return (bootstrapped && props.children) || null;
};