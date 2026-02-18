import { Orientation } from "./Orientation";
import { Size, SplitElement } from "./useSplit";

export class InitialState {
    public readonly initialMousePos: [number, number];
    public readonly initialElements: SplitElement[];
    public readonly direction: Orientation;
    public readonly separatorIndex: number;
    public readonly separatorSize: Size;
    public readonly wrapperSize: Size;

    constructor(
        mousePos: [number, number],
        elements: SplitElement[],
        direction: Orientation,
        separatorIndex: number,
        separatorSize: Size,
        wrapperSize: Size
    ) {
        this.initialMousePos = mousePos;
        this.initialElements = elements;
        this.direction = direction;
        this.separatorIndex = separatorIndex;
        this.separatorSize = separatorSize;
        this.wrapperSize = wrapperSize;
    }
}
