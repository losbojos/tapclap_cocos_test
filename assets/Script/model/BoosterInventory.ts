import { BoosterBaseConfig, BoosterType, BOOSTERS_CONFIG } from "./BoosterConfig";

export default class BoosterInventory {
    private readonly _counts = new Map<BoosterType, number>();

    constructor(config: ReadonlyArray<BoosterBaseConfig> = BOOSTERS_CONFIG) {
        config.forEach((entry) => {
            this._counts.set(entry.type, entry.initialCount);
        });
    }

    getCount(type: BoosterType): number {
        return this._counts.get(type) ?? 0;
    }

    canUse(type: BoosterType): boolean {
        return this.getCount(type) > 0;
    }

    /** Списывает один заряд. false — зарядов не было. */
    consume(type: BoosterType): boolean {
        const count = this.getCount(type);
        if (count <= 0) {
            return false;
        }

        this._counts.set(type, count - 1);
        return true;
    }
}
