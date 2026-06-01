import BoosterInventory from "./BoosterInventory";

/** Состояние текущей сессии игры. */
export default class GameSession {
    private readonly _boosters = new BoosterInventory();

    get boosters(): BoosterInventory {
        return this._boosters;
    }
}
