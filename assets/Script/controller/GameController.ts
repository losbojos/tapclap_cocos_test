// Learn TypeScript:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/typescript.html
// Learn Attribute:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/life-cycle-callbacks.html

import GameConfig from "../GameConfig";
import Board from "../model/Board";
import GameState from "../model/GameState";
import AnimateEffects from "../view/AnimateEffects";
import BoardView from "../view/BoardView";
import HudView from "../view/HudView";

const { ccclass, property } = cc._decorator;

@ccclass
export default class GameController extends cc.Component {

    private _board?: Board;
    private _boardView: BoardView | null = null;
    private _hud: HudView | null = null;
    private _isShuffling: boolean = false;
    private readonly _gameState = new GameState(GameConfig.WIN_SCORE, GameConfig.TOTAL_MOVES);

    @property(cc.Node)
    boardNode: cc.Node | null = null;

    @property(HudView)
    hud: HudView | null = null;

    /** Узел с Sprite на весь экран; если пусто — ищется дочерний `background` у Canvas */
    @property(cc.Node)
    appBackgroundNode: cc.Node | null = null;

    @property(cc.SpriteFrame)
    appBgMobile: cc.SpriteFrame | null = null;

    @property(cc.SpriteFrame)
    appBgDesktop: cc.SpriteFrame | null = null;

    onLoad() {
        cc.log('[GameController] ready');

        if (!this._boardView && this.boardNode) {
            this._boardView = this.boardNode.getComponent(BoardView);
        }

        this._hud = this.hud; // || this.findHudView();
        //this.bindHudFromScene();

        this.autoFitCanvas();
        this.applyAppBackground();
        //this.scheduleOnce(() => this.applyAppBackground(), 0);
    }

    start() {
        //this.applyAppBackground();
        this._board = new Board(GameConfig.COLS, GameConfig.ROWS);
        cc.log('[GameController] Board created:', this._board.toString());

        if (!this._boardView) {
            cc.error('[GameController] BoardView not found. Add BoardView to boardNode, assign in Inspector, save scene.');
            return;
        }

        if (!this._hud) {
            cc.warn('[GameController] HudView not found. Add HudView to header and assign labels.');
        } else {
            this.refreshHud();
        }

        this._boardView.setOnTileClick((col, row) => this.onTileClicked(col, row));
        this._boardView.render(this._board);
        this.evaluateEndOfGame();
    }

    private autoFitCanvas() {
        const canvas = this.node.getComponent(cc.Canvas);

        const designSize = cc.view.getDesignResolutionSize();
        cc.log('designSize', designSize);

        const screenSize = cc.view.getFrameSize();
        cc.log('screenSize', screenSize);

        // Сравниваем соотношения сторон дизайна и экрана устройства
        if (screenSize.width / screenSize.height > designSize.width / designSize.height) {
            // Экран шире -> подгоняем по высоте
            canvas.fitHeight = true;
            canvas.fitWidth = false;
        } else {
            // Экран уже -> подгоняем по ширине
            canvas.fitWidth = true;
            canvas.fitHeight = false;
        }        
    }

    /** Фон приложения: мобильный / десктопный спрайт по `cc.sys.isMobile` */
    private applyAppBackground(): void {
        const bgNode = this.appBackgroundNode || this.node.getChildByName('background');
        if (!bgNode) {
            cc.warn('[GameController] Background node not found. Add child `background` with Sprite or assign appBackgroundNode.');
            return;
        }

        const sprite = bgNode.getComponent(cc.Sprite);
        if (!sprite) {
            cc.warn('[GameController] Node for app background has no Sprite component.');
            return;
        }

        bgNode.color = cc.color(255, 255, 255);
        bgNode.opacity = 255;
        bgNode.zIndex = -1000;

        const parent = bgNode.parent;
        if (parent) {
            const cameraNode = parent.getChildByName('Main Camera');
            const targetIndex = cameraNode ? cameraNode.getSiblingIndex() + 1 : 0;
            bgNode.setSiblingIndex(targetIndex);
        }

        const frame = cc.sys.isMobile ? this.appBgMobile : this.appBgDesktop;
        if (frame) {
            sprite.spriteFrame = frame;
            cc.log(`[GameController] App background: ${cc.sys.isMobile ? 'mobile' : 'desktop'}`);
        } else {
            cc.warn(
                `[GameController] Assign appBgMobile and appBgDesktop in Inspector (missing: ${cc.sys.isMobile ? 'appBgMobile' : 'appBgDesktop'}).`
            );
        }
    }

    /*
    private findHudView(): HudView | null {
        const header = this.node.getChildByName('header');
        if (header) {
            const hudOnHeader = header.getComponent(HudView);
            if (hudOnHeader) {
                return hudOnHeader;
            }
        }

        return this.getComponent(HudView);
    }

    private bindHudFromScene(): void {
        if (!this._hud) {
            return;
        }

        const header = this.node.getChildByName('header');
        if (!header) {
            return;
        }

        const content = header.getChildByName('content');
        if (!content) {
            return;
        }

        if (!this._hud.movesLabel) {
            const movesIndicator = content.getChildByName('movesIndicator');
            const movesLabelNode = movesIndicator?.getChildByName('movesLabel');
            const movesLabel = movesLabelNode?.getComponent(cc.Label);
            if (movesLabel) {
                this._hud.movesLabel = movesLabel;
            }
        }

        const scoreIndicator = content.getChildByName('scoreIndicator');
        if (!scoreIndicator) {
            return;
        }

        if (!this._hud.scoreTitleLabel) {
            const scoreTitle = scoreIndicator.getChildByName('scoreTitle')?.getComponent(cc.Label);
            if (scoreTitle) {
                this._hud.scoreTitleLabel = scoreTitle;
            }
        }

        if (!this._hud.scoreValueLabel) {
            const scoreValue = scoreIndicator.getChildByName('scoreValue')?.getComponent(cc.Label);
            if (scoreValue) {
                this._hud.scoreValueLabel = scoreValue;
            }
        }
    }
    */

    private refreshHud(): void {
        if (this._hud) {
            this._hud.render(this._gameState);
        }
    }

    private onTileClicked(col: number, row: number): void {
        if (!this._board || !this._boardView || !this._gameState.isPlaying) {
            return;
        }

        if (this._boardView.isAnimating || this._isShuffling) {
            return;
        }

        const group = this._board.findGroup(col, row);
        if (!Board.isBlastableGroup(group)) {
            cc.log(`[GameController] click (${col}, ${row}): group too small (${group.length})`);
            return;
        }

        this._boardView.playBlast(this._board, group, (score) => {
            this._gameState.applyMove(score);
            cc.log(
                `[GameController] blast done: +${score}, score=${this._gameState.score}, moves=${this._gameState.movesRemaining}`
            );
            this.evaluateEndOfGame();
        });
    }

    private evaluateEndOfGame(): void {
        if (!this._board || !this._boardView) {
            return;
        }

        if (!this._gameState.isGameOver && !this._isShuffling) {
            if (!this._board.hasAnyBlastableMove()) {
                this._isShuffling = true;
                this.runShuffleAttempt(1);
            }
        }

        this.refreshHud();
    }

    private runShuffleAttempt(attempt: number): void {
        if (!this._board || !this._boardView) {
            this._isShuffling = false;
            return;
        }

        this._board.shuffleTiles();
        AnimateEffects.shakeNodeX(this.boardNode, 18, Math.min(0.05, GameConfig.SHUFFLE_STEP_DELAY_SEC / 6));
        this._boardView.render(this._board);
        
        cc.log(`[GameController] Shuffle ${attempt}/${GameConfig.MAX_SHUFFLE_ATTEMPTS}`);

        if (this._board.hasAnyBlastableMove()) {
            this._isShuffling = false;
            cc.log(`[GameController] Shuffle complete: valid moves found on attempt ${attempt}.`);
            this.refreshHud();
            return;
        }

        if (attempt >= GameConfig.MAX_SHUFFLE_ATTEMPTS) {
            this._isShuffling = false;
            this._gameState.setLose("There are no valid moves in the game");
            cc.log(`[GameController] LOSE: ${this._gameState.getLoseReason()}`);
            this.refreshHud();
            return;
        }

        this.scheduleOnce(() => this.runShuffleAttempt(attempt + 1), GameConfig.SHUFFLE_STEP_DELAY_SEC);
    }
}
