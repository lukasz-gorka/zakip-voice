export function LoadingScreen() {
    return (
        <div className="flex h-screen w-screen items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-muted border-t-primary"></div>

                <div className="text-center">
                    <h2 className="text-lg font-semibold text-foreground">Initializing...</h2>
                    <p className="text-sm text-muted-foreground">Loading your workspace</p>
                </div>
            </div>
        </div>
    );
}
