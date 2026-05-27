const { ccclass, property } = cc._decorator;
import GameConfig from "../GameConfig";
import GameState from "../model/GameState";
import { GameStatus } from "../model/GameStatus";

@ccclass
export default class HudView extends cc.Component {

    @property(cc.Label)
    movesLabel: cc.Label | null = null;

    @property(cc.Label)
    scoreTitleLabel: cc.Label | null = null;

    @property(cc.Label)
    scoreValueLabel: cc.Label | null = null;

    render(state: GameState): void {
        if (state.status === GameStatus.Won) {
            this.setMoves("");
            this.setScore("ПОБЕДА!", `${state.score}`);
            return;
        }

        if (state.status === GameStatus.Lost) {
            this.setMoves("");
            this.setScore("ПОРАЖЕНИЕ", `${state.score}`);
            return;
        }

        this.setMoves(`${state.movesRemaining}`);
        this.setScore("ОЧКИ:", `${state.score}/${GameConfig.WIN_SCORE}`);
    }

    private setMoves(text: string): void {
        if (this.movesLabel) {
            this.movesLabel.string = text;
        }
    }

    private setScore(title: string, value: string): void {
        if (this.scoreTitleLabel) {
            this.scoreTitleLabel.string = title;
        }
        if (this.scoreValueLabel) {
            this.scoreValueLabel.string = value;
        }
    }
}
