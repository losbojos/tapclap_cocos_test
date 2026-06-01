const { ccclass, property } = cc._decorator;

import {
    BoosterType,
    BoosterViewConfig,
    BOOSTERS_CONFIG,
} from "../model/BoosterConfig";

type BoosterUiState = {
    count: number;
    label: cc.Label;
    button: cc.Button;
    itemNode: cc.Node;
    baseScaleX: number;
    baseScaleY: number;
    config: BoosterViewConfig;
};

@ccclass
export default class BoostersView extends cc.Component {
    @property(cc.Label)
    titleLabel: cc.Label | null = null;

    @property(cc.Node)
    boostersContent: cc.Node | null = null;

    /** Скрытый шаблон в boostersContent (Active = false в Editor). */
    @property(cc.Node)
    boosterItemTemplate: cc.Node | null = null;

    @property(cc.SpriteFrame)
    bombIcon: cc.SpriteFrame | null = null;

    @property(cc.SpriteFrame)
    teleportIcon: cc.SpriteFrame | null = null;

    private readonly _boosterStates = new Map<BoosterType, BoosterUiState>();
    private _configs: BoosterViewConfig[] = [];

    onLoad(): void {
        if (!this.boostersContent) {
            this.boostersContent = this.node.getChildByName("boostersContent");
        }
        if (!this.boosterItemTemplate && this.boostersContent) {
            this.boosterItemTemplate = this.boostersContent.getChildByName("boosterItemTemplate");
        }
        if (!this.boostersContent) {
            cc.warn("[BoostersView] boostersContent node not found.");
        }
        if (!this.boosterItemTemplate) {
            cc.warn("[BoostersView] boosterItemTemplate node not found.");
        } else {
            this.boosterItemTemplate.active = false;
        }
    }

    /**
     * Инициализация отображения бустеров по конфигурации.
     */
    init(onUseBooster: (type: BoosterType) => boolean): void {
        this._configs = BOOSTERS_CONFIG.map((baseCfg) => ({
            ...baseCfg,
            icon: this.getIconByType(baseCfg.type),
            onUse: () => onUseBooster(baseCfg.type),
        }));

        this.renderBoosterButtons();
    }

    private renderBoosterButtons(): void {
        if (!this.boostersContent || !this.boosterItemTemplate) {
            cc.warn("[BoostersView] boostersContent or boosterItemTemplate is not assigned.");
            return;
        }

        this.clearBoosterItems();
        this._boosterStates.clear();

        this._configs.forEach((cfg) => {
            const itemNode = cc.instantiate(this.boosterItemTemplate!);
            itemNode.name = `booster_${cfg.type}`;
            itemNode.active = true;

            const iconSprite = itemNode.getChildByName("icon")?.getComponent(cc.Sprite);
            if (iconSprite && cfg.icon) {
                iconSprite.spriteFrame = cfg.icon;
            } else if (!cfg.icon) {
                cc.warn(`[BoostersView] Missing icon for booster: ${cfg.type}`);
            }

            const countLabel = this.findCountLabel(itemNode);
            if (!countLabel) {
                cc.warn(`[BoostersView] countLabel not found in template for: ${cfg.type}`);
                return;
            }

            const button = itemNode.getComponent(cc.Button);
            if (!button) {
                cc.warn(`[BoostersView] Button not found on boosterItemTemplate for: ${cfg.type}`);
                return;
            }

            // Масштаб и подсветку ведём сами — иначе Button.zoom конфликтует с tween.
            button.transition = cc.Button.Transition.COLOR;
            button.duration = 0.08;
            button.zoomScale = 1;

            this._boosterStates.set(cfg.type, {
                count: cfg.initialCount,
                label: countLabel,
                button,
                itemNode,
                baseScaleX: itemNode.scaleX,
                baseScaleY: itemNode.scaleY,
                config: cfg,
            });

            this.refreshBoosterView(cfg.type, null);

            itemNode.on(cc.Node.EventType.TOUCH_END, () => this.tryUseBooster(cfg.type));
            this.boostersContent!.addChild(itemNode);
        });
    }

    /** Удаляет только клоны бустеров, шаблон оставляет. */
    private clearBoosterItems(): void {
        if (!this.boostersContent) {
            return;
        }

        const toRemove = this.boostersContent.children.filter(
            (child) => child !== this.boosterItemTemplate
        );
        toRemove.forEach((child) => child.destroy());
    }

    private findCountLabel(itemNode: cc.Node): cc.Label | null {
        const countBg = itemNode.getChildByName("countBg");
        const countLabelNode = countBg?.getChildByName("countLabel") ?? itemNode.getChildByName("countLabel");
        return countLabelNode?.getComponent(cc.Label) ?? null;
    }

    private tryUseBooster(type: BoosterType): void {
        const state = this._boosterStates.get(type);
        if (!state || state.count <= 0) {
            return;
        }

        if (!state.config.onUse()) {
            return;
        }

        this.consumeBooster(type);
    }

    /** Подсветить бустер, готовый к применению (null — все в обычном виде). */
    /** Обновить подсветку кнопок; armedBooster приходит из GameController (_pendingBooster). */
    setActiveBooster(armedBooster: BoosterType | null): void {
        if (armedBooster === null) {
            this._boosterStates.forEach((_, boosterType) => this.refreshBoosterView(boosterType, null));
            return;
        }

        // Сначала сбрасываем остальные, активный — последним (чтобы не убить его tween).
        this._boosterStates.forEach((_, boosterType) => {
            if (boosterType !== armedBooster) {
                this.refreshBoosterView(boosterType, null);
            }
        });
        this.refreshBoosterView(armedBooster, armedBooster);
    }

    /** Списать один заряд (после успешного применения бомбы по клетке и т.п.). */
    consumeBooster(type: BoosterType): void {
        const state = this._boosterStates.get(type);
        if (!state || state.count <= 0) {
            return;
        }

        state.count -= 1;
        this.refreshBoosterView(type, null);
    }

    private refreshBoosterView(type: BoosterType, armedBooster: BoosterType | null): void {
        const state = this._boosterStates.get(type);
        if (!state) {
            return;
        }

        const hasCharges = state.count > 0;
        const isArmed = armedBooster === type && hasCharges;

        state.label.string = `${state.count}`;
        state.button.interactable = hasCharges;

        if (!hasCharges) {
            this.resetBoosterItemVisual(state, 120);
            return;
        }

        if (isArmed) {
            state.itemNode.opacity = 255;
            state.itemNode.color = cc.color(255, 245, 170);
            this.startBoosterPulse(state);
            return;
        }

        this.resetBoosterItemVisual(state, 255);
    }

    private resetBoosterItemVisual(state: BoosterUiState, opacity: number): void {
        this.stopBoosterPulse(state);
        state.itemNode.opacity = opacity;
        state.itemNode.color = cc.Color.WHITE;
    }

    private stopBoosterPulse(state: BoosterUiState): void {
        cc.Tween.stopAllByTarget(state.itemNode);
        state.itemNode.setScale(state.baseScaleX, state.baseScaleY);
    }

    private startBoosterPulse(state: BoosterUiState): void {
        this.stopBoosterPulse(state);

        const pulseMin = 1.1;
        const pulseMax = 1.14;
        state.itemNode.setScale(state.baseScaleX * pulseMin, state.baseScaleY * pulseMin);

        cc.tween(state.itemNode)
            .to(0.35, {
                scaleX: state.baseScaleX * pulseMax,
                scaleY: state.baseScaleY * pulseMax,
            })
            .to(0.35, {
                scaleX: state.baseScaleX * pulseMin,
                scaleY: state.baseScaleY * pulseMin,
            })
            .union()
            .repeatForever()
            .start();
    }

    private getIconByType(type: BoosterType): cc.SpriteFrame | null {
        switch (type) {
            case BoosterType.BOMB:
                if (!this.bombIcon) {
                    cc.warn("[BoostersView] Assign bombIcon in Inspector.");
                }
                return this.bombIcon;
            case BoosterType.TELEPORT:
                if (!this.teleportIcon) {
                    cc.warn("[BoostersView] Assign teleportIcon in Inspector.");
                }
                return this.teleportIcon;
            default:
                return null;
        }
    }
}
