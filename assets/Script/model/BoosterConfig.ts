export enum BoosterType {
    BOMB = "bomb",
    TELEPORT = "teleport",
}

export type BoosterUseHandler = () => void;

export interface BoosterBaseConfig {
    type: BoosterType;
    initialCount: number;
}

export interface BoosterViewConfig extends BoosterBaseConfig {
    icon: cc.SpriteFrame | null;
    onUse: BoosterUseHandler;
}

export const BOOSTERS_CONFIG: ReadonlyArray<BoosterBaseConfig> = [
    { type: BoosterType.TELEPORT, initialCount: 5 },
    { type: BoosterType.BOMB, initialCount: 3 },
];

