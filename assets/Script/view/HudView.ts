const { ccclass, property } = cc._decorator;
import GameConfig from "../GameConfig";
import GameState from "../model/GameState";
import { GameStatus } from "../model/GameStatus";

@ccclass
export default class HudView extends cc.Component {

    @property(cc.Label)
    infoLabel: cc.Label | null = null;

    render(state: GameState): void {
        if (!this.infoLabel) {
            return;
        }

        if (state.status === GameStatus.Won) {
            this.infoLabel.string = `Победа! Очки: ${state.score}`;
            return;
        }

        if (state.status === GameStatus.Lost) {
            this.infoLabel.string = `Поражение. ${state.getLoseReason()}. Очки: ${state.score}`;
            return;
        }

        this.infoLabel.string =
            `Очки: ${state.score} / ${GameConfig.WIN_SCORE}    Ходов осталось: ${state.movesRemaining}`;
    }
}
