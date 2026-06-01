export enum BoosterType {
    BOMB = "bomb",
    TELEPORT = "teleport",
}

/** false — бустер не списан (например, бомба только взведена). */
export type BoosterUseHandler = () => boolean;

export interface BoosterBaseConfig {
    type: BoosterType;
    initialCount: number;
}

/** Конфиг кнопки бустера во View (без initialCount — заряды в BoosterInventory). */
export interface BoosterViewConfig {
    type: BoosterType;
    icon: cc.SpriteFrame | null;
    onUse: BoosterUseHandler;
}

export const BOOSTERS_CONFIG: ReadonlyArray<BoosterBaseConfig> = [
    { type: BoosterType.TELEPORT, initialCount: 5 },
    { type: BoosterType.BOMB, initialCount: 3 },
];

