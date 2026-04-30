export interface TextBlock {
    id: string;
    slideNumber: number;
    title: string;
    content: string;
    x: number;
    y: number;
    width: number;
    fontSize: number;
    color: string; // ← add this
}