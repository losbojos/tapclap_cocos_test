const { ccclass, property } = cc._decorator;
import GameConfig from "../GameConfig";
import GameSession from "../model/GameSession";
import { GameStatus } from "../model/GameStatus";

@ccclass
export default class HudView extends cc.Component {

    @property(cc.Label)
    movesLabel: cc.Label | null = null;

    @property(cc.Label)
    scoreTitleLabel: cc.Label | null = null;

    @property(cc.Label)
    scoreValueLabel: cc.Label | null = null;

    render(session: GameSession): void {
        if (session.status === GameStatus.Won) {
            this.setMoves("");
            this.setScore("ПОБЕДА!", `${session.score}`);
            return;
        }

        if (session.status === GameStatus.Lost) {
            this.setMoves("");
            this.setScore("ПОРАЖЕНИЕ", `${session.score}`);
            return;
        }

        this.setMoves(`${session.movesRemaining}`);
        this.setScore("ОЧКИ:", `${session.score}/${GameConfig.WIN_SCORE}`);
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
