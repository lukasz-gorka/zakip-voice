import {Outlet} from "react-router-dom";
import {MainLayout} from "./MainLayout.tsx";

export default function Layout() {
    return (
        <MainLayout>
            <Outlet />
        </MainLayout>
    );
}
