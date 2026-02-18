export class SeparatorEventHandler {
    public onMouseDown?: (ev: React.MouseEvent, separatorIndex: number) => void;
    public onMove?: (clientX: number, clientY: number) => void;
    public onMouseUp?: () => void;

    public handleMouseDown = (separatorIndex: number, ev: React.MouseEvent) => {
        ev.preventDefault();
        this.onMouseDown?.(ev, separatorIndex);
        document.addEventListener("mousemove", this.handleMouseMove);
        document.addEventListener("mouseup", this.handleMouseUp);
    };

    private handleMouseMove = (ev: MouseEvent) => {
        ev.preventDefault();
        this.onMove?.(ev.clientX, ev.clientY);
    };

    private handleMouseUp = (ev: MouseEvent) => {
        ev.preventDefault();
        document.removeEventListener("mousemove", this.handleMouseMove);
        document.removeEventListener("mouseup", this.handleMouseUp);
    };
}
