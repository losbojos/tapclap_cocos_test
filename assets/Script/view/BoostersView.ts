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
    init(onUseBooster: (type: BoosterType) => void): void {
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

            this._boosterStates.set(cfg.type, {
                count: cfg.initialCount,
                label: countLabel,
                button,
                config: cfg,
            });

            this.refreshBoosterView(cfg.type);

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

        state.count -= 1;
        this.refreshBoosterView(type);
        state.config.onUse();
    }

    private refreshBoosterView(type: BoosterType): void {
        const state = this._boosterStates.get(type);
        if (!state) {
            return;
        }
        state.label.string = `${state.count}`;
        state.button.interactable = state.count > 0;
        state.button.node.opacity = state.count > 0 ? 255 : 120;
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
