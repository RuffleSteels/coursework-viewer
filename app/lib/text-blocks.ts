export interface TextBlock {
    id: string;
    slideNumber: number;
    title: string;
    content: string;
    x: number;
    y: number;
    width: number;
    fontSize: number;
    color: string;
    expandDirection?: 'left' | 'right'; // ← add this
}

export const textBoxMixerTitle = '65%, #0a0a0a20'
export const textBoxMixer = '35%, #0a0a0a40'