import {
    _decorator,
    Color,
    Component,
    director,
    Graphics,
    Label,
    Node,
    Sprite,
    SpriteFrame,
    sys,
    Tween,
    tween,
    UIOpacity,
    UITransform,
    view,
} from 'cc';
import { AudioManager, AudioSettings } from './AudioManager';

const { ccclass, property } = _decorator;

type BirdSkinId = 'default' | 'red' | 'blue' | 'purple';

interface BirdSkinConfig {
    id: BirdSkinId;
    frames: SpriteFrame[];
    preview: Node | null;
    priceLabel: Label | null;
    selectedMark: Node | null;
    price: number;
}

@ccclass('StartMenu')
export class StartMenu extends Component {
    @property(Node)
    public contentRoot: Node | null = null;

    @property(Node)
    public background: Node | null = null;

    @property(Node)
    public bird: Node | null = null;

    @property(Node)
    public button: Node | null = null;

    @property(Label)
    public buttonLabel: Label | null = null;

    @property(Node)
    public shopButton: Node | null = null;

    @property(Label)
    public shopButtonLabel: Label | null = null;

    @property(Node)
    public woodJumpButton: Node | null = null;

    @property(Label)
    public woodJumpButtonLabel: Label | null = null;

    @property(Node)
    public shopPanel: Node | null = null;

    @property(Label)
    public coinBalanceLabel: Label | null = null;

    @property(Label)
    public shopMessageLabel: Label | null = null;

    @property(Node)
    public closeShopButton: Node | null = null;

    @property(Label)
    public closeShopLabel: Label | null = null;

    @property(Node)
    public settingButton: Node | null = null;

    @property(Node)
    public settingPanel: Node | null = null;

    @property(Node)
    public musicSwitch: Node | null = null;

    @property(Node)
    public soundSwitch: Node | null = null;

    @property(Node)
    public closeSettingButton: Node | null = null;

    @property(Label)
    public closeSettingLabel: Label | null = null;

    @property(Node)
    public defaultBirdPreview: Node | null = null;

    @property(Node)
    public redBirdPreview: Node | null = null;

    @property(Node)
    public blueBirdPreview: Node | null = null;

    @property(Node)
    public purpleBirdPreview: Node | null = null;

    @property(Node)
    public redActionButton: Node | null = null;

    @property(Label)
    public redActionLabel: Label | null = null;

    @property(Node)
    public blueActionButton: Node | null = null;

    @property(Label)
    public blueActionLabel: Label | null = null;

    @property(Node)
    public purpleActionButton: Node | null = null;

    @property(Label)
    public purpleActionLabel: Label | null = null;

    @property(Label)
    public defaultPriceLabel: Label | null = null;

    @property(Label)
    public redPriceLabel: Label | null = null;

    @property(Label)
    public bluePriceLabel: Label | null = null;

    @property(Label)
    public purplePriceLabel: Label | null = null;

    @property(Node)
    public defaultSelectedMark: Node | null = null;

    @property(Node)
    public redSelectedMark: Node | null = null;

    @property(Node)
    public blueSelectedMark: Node | null = null;

    @property(Node)
    public purpleSelectedMark: Node | null = null;

    @property(SpriteFrame)
    public buttonNormalFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public buttonPressedFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public switchOnFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public switchOffFrame: SpriteFrame | null = null;

    @property([SpriteFrame])
    public birdFrames: SpriteFrame[] = [];

    @property([SpriteFrame])
    public redBirdFrames: SpriteFrame[] = [];

    @property([SpriteFrame])
    public blueBirdFrames: SpriteFrame[] = [];

    @property([SpriteFrame])
    public purpleBirdFrames: SpriteFrame[] = [];

    private readonly coinScoreKey = 'flappy_coin_score';
    private readonly ownedBirdsKey = 'flappy_owned_birds';
    private readonly selectedBirdKey = 'flappy_selected_bird';
    private readonly birdPrice = 300;
    private readonly designWidth = 640;
    private readonly designHeight = 1280;

    private birdAnimTimer = 0;
    private birdFrameIndex = 0;
    private elapsedTime = 0;
    private birdBaseY = 0;
    private coinBalance = 0;
    private selectedBird: BirdSkinId = 'default';
    private ownedBirds = new Set<BirdSkinId>(['default']);
    private pressedButton: Node | null = null;
    private pressedSkinPreview: Node | null = null;
    private pressedPlainNode: Node | null = null;
    private notEnoughToast: Node | null = null;
    private isLoadingGame = false;

    private readonly birdFrameInterval = 0.12;
    private readonly birdFloatAmplitude = 18;
    private readonly birdFloatDuration = 1.5;

    protected onLoad(): void {
        AudioManager.ensure();
        this.resolveSceneNodes();
        this.loadShopState();
        this.configureSceneNodes();
        this.bindButtonEvents();
        this.updateContentFit();
    }

    protected update(deltaTime: number): void {
        this.updateContentFit();
        this.updateBird(deltaTime);
    }

    private resolveSceneNodes(): void {
        this.contentRoot = this.contentRoot || this.node.getChildByName('StartContent') || this.node;
        this.background = this.background || this.node.getChildByName('StartBackground');
        this.bird = this.bird || this.contentRoot.getChildByName('StartBird');
        this.button = this.button || this.contentRoot.getChildByName('StartButton');
        this.shopButton = this.shopButton || this.contentRoot.getChildByName('ShopButton');
        this.woodJumpButton = this.woodJumpButton || this.contentRoot.getChildByName('WoodJumpButton');
        this.shopPanel = this.shopPanel || this.contentRoot.getChildByName('ShopPanel');
        this.settingButton = this.settingButton || this.contentRoot.getChildByName('SettingButton');
        this.settingPanel = this.settingPanel || this.contentRoot.getChildByName('SettingPanel');

        this.buttonLabel = this.buttonLabel || this.getLabelByPath('StartButton/StartButtonLabel');
        this.shopButtonLabel = this.shopButtonLabel || this.getLabelByPath('ShopButton/ShopButtonLabel');
        this.woodJumpButtonLabel = this.woodJumpButtonLabel || this.getLabelByPath('WoodJumpButton/WoodJumpButtonLabel');
        this.coinBalanceLabel = this.coinBalanceLabel || this.getLabelByPath('ShopPanel/CoinBalanceLabel');
        this.shopMessageLabel = this.shopMessageLabel || this.getLabelByPath('ShopPanel/ShopMessageLabel');
        this.closeShopButton = this.closeShopButton || this.getNodeByPath('ShopPanel/CloseShopButton');
        this.closeShopLabel = this.closeShopLabel || this.getLabelByPath('ShopPanel/CloseShopButton/CloseShopLabel');
        this.musicSwitch = this.musicSwitch || this.getNodeByPath('SettingPanel/MusicSwitch');
        this.soundSwitch = this.soundSwitch || this.getNodeByPath('SettingPanel/SoundSwitch');
        this.closeSettingButton = this.closeSettingButton || this.getNodeByPath('SettingPanel/CloseSettingButton');
        this.closeSettingLabel = this.closeSettingLabel || this.getLabelByPath('SettingPanel/CloseSettingButton/CloseSettingLabel');

        this.defaultBirdPreview = this.defaultBirdPreview || this.getNodeByPath('ShopPanel/DefaultBirdPreview');
        this.redBirdPreview = this.redBirdPreview || this.getNodeByPath('ShopPanel/RedBirdPreview');
        this.blueBirdPreview = this.blueBirdPreview || this.getNodeByPath('ShopPanel/BlueBirdPreview');
        this.purpleBirdPreview = this.purpleBirdPreview || this.getNodeByPath('ShopPanel/PurpleBirdPreview');
        this.redActionButton = this.redActionButton || this.getNodeByPath('ShopPanel/RedActionButton');
        this.blueActionButton = this.blueActionButton || this.getNodeByPath('ShopPanel/BlueActionButton');
        this.purpleActionButton = this.purpleActionButton || this.getNodeByPath('ShopPanel/PurpleActionButton');
        this.redActionLabel = this.redActionLabel || this.getLabelByPath('ShopPanel/RedActionButton/RedActionLabel');
        this.blueActionLabel = this.blueActionLabel || this.getLabelByPath('ShopPanel/BlueActionButton/BlueActionLabel');
        this.purpleActionLabel = this.purpleActionLabel || this.getLabelByPath('ShopPanel/PurpleActionButton/PurpleActionLabel');

        this.defaultPriceLabel = this.defaultPriceLabel || this.getLabelByPath('ShopPanel/DefaultPriceLabel');
        this.redPriceLabel = this.redPriceLabel || this.getLabelByPath('ShopPanel/RedBirdNameLabel');
        this.bluePriceLabel = this.bluePriceLabel || this.getLabelByPath('ShopPanel/BlueBirdNameLabel');
        this.purplePriceLabel = this.purplePriceLabel || this.getLabelByPath('ShopPanel/PurpleBirdNameLabel');

        this.defaultSelectedMark = this.defaultSelectedMark || this.getNodeByPath('ShopPanel/DefaultSelectedMark');
        this.redSelectedMark = this.redSelectedMark || this.getNodeByPath('ShopPanel/RedSelectedMark');
        this.blueSelectedMark = this.blueSelectedMark || this.getNodeByPath('ShopPanel/BlueSelectedMark');
        this.purpleSelectedMark = this.purpleSelectedMark || this.getNodeByPath('ShopPanel/PurpleSelectedMark');
    }

    private configureSceneNodes(): void {
        if (this.bird) {
            this.birdBaseY = this.bird.position.y;
            this.refreshStartBirdFrame();
        }

        this.configureButton(this.button, this.buttonLabel, '跃动小飞鸟');
        this.configureButton(this.woodJumpButton, this.woodJumpButtonLabel, '小鸟向上飞');
        this.configureButton(this.shopButton, this.shopButtonLabel, '小鸟商店');
        this.configureButton(this.closeShopButton, this.closeShopLabel, '返回');
        this.configureButton(this.closeSettingButton, this.closeSettingLabel, '关闭');
        this.hideLegacyPurchaseButtons();

        for (const skin of this.getShopSkins()) {
            if (skin.preview) {
                this.setSpriteFrame(skin.preview, skin.frames[0] || null);
            }
        }

        if (this.shopPanel) {
            this.shopPanel.active = false;
        }
        if (this.settingPanel) {
            this.settingPanel.active = false;
        }

        this.refreshSettingSwitches();
        this.refreshShopUi('');
    }

    private configureButton(button: Node | null, label: Label | null, text: string): void {
        if (!button) {
            return;
        }

        this.setSpriteFrame(button, this.buttonNormalFrame);

        if (!label) {
            return;
        }

        if (text) {
            label.string = text;
        }
    }

    private bindButtonEvents(): void {
        this.bindButton(this.button, () => this.enterGame());
        this.bindButton(this.woodJumpButton, () => this.enterWoodJump());
        this.bindButton(this.shopButton, () => this.openShop());
        this.bindButton(this.closeShopButton, () => this.closeShop());
        this.bindPlainTap(this.settingButton, () => this.openSettingPanel());
        this.bindButton(this.closeSettingButton, () => this.closeSettingPanel());
        this.bindPlainTap(this.musicSwitch, () => this.toggleMusic());
        this.bindPlainTap(this.soundSwitch, () => this.toggleSound());
        this.bindSkinPreview(this.defaultBirdPreview, 'default');
        this.bindSkinPreview(this.redBirdPreview, 'red');
        this.bindSkinPreview(this.blueBirdPreview, 'blue');
        this.bindSkinPreview(this.purpleBirdPreview, 'purple');
    }

    private bindButton(button: Node | null, onClick: () => void): void {
        if (!button) {
            return;
        }

        button.on(Node.EventType.TOUCH_START, () => {
            this.pressedButton = button;
            this.setSpriteFrame(button, this.buttonPressedFrame || this.buttonNormalFrame);
        }, this);
        button.on(Node.EventType.TOUCH_CANCEL, () => {
            if (this.pressedButton === button) {
                this.pressedButton = null;
            }
            this.setSpriteFrame(button, this.buttonNormalFrame);
        }, this);
        button.on(Node.EventType.TOUCH_END, () => {
            const shouldClick = this.pressedButton === button;
            this.pressedButton = null;
            this.setSpriteFrame(button, this.buttonNormalFrame);
            if (shouldClick) {
                onClick();
            }
        }, this);
    }

    private bindSkinPreview(preview: Node | null, id: BirdSkinId): void {
        if (!preview) {
            return;
        }

        preview.on(Node.EventType.TOUCH_START, () => {
            this.pressedSkinPreview = preview;
        }, this);
        preview.on(Node.EventType.TOUCH_CANCEL, () => {
            if (this.pressedSkinPreview === preview) {
                this.pressedSkinPreview = null;
            }
        }, this);
        preview.on(Node.EventType.TOUCH_END, () => {
            const shouldClick = this.pressedSkinPreview === preview;
            this.pressedSkinPreview = null;
            if (shouldClick) {
                this.handleSkinAction(id);
            }
        }, this);
    }

    private bindPlainTap(node: Node | null, onClick: () => void): void {
        if (!node) {
            return;
        }

        node.on(Node.EventType.TOUCH_START, () => {
            this.pressedPlainNode = node;
        }, this);
        node.on(Node.EventType.TOUCH_CANCEL, () => {
            if (this.pressedPlainNode === node) {
                this.pressedPlainNode = null;
            }
        }, this);
        node.on(Node.EventType.TOUCH_END, () => {
            const shouldClick = this.pressedPlainNode === node;
            this.pressedPlainNode = null;
            if (shouldClick) {
                onClick();
            }
        }, this);
    }

    private openSettingPanel(): void {
        if (!this.settingPanel) {
            return;
        }

        this.refreshSettingSwitches();
        this.settingPanel.active = true;
    }

    private closeSettingPanel(): void {
        if (this.settingPanel) {
            this.settingPanel.active = false;
        }
    }

    private toggleMusic(): void {
        AudioSettings.setMusicEnabled(!AudioSettings.isMusicEnabled());
        this.refreshSettingSwitches();
        AudioManager.refreshMusic();
    }

    private toggleSound(): void {
        AudioSettings.setSoundEnabled(!AudioSettings.isSoundEnabled());
        this.refreshSettingSwitches();
    }

    private refreshSettingSwitches(): void {
        this.setSpriteFrame(
            this.musicSwitch,
            AudioSettings.isMusicEnabled() ? this.switchOnFrame : this.switchOffFrame,
        );
        this.setSpriteFrame(
            this.soundSwitch,
            AudioSettings.isSoundEnabled() ? this.switchOnFrame : this.switchOffFrame,
        );
    }

    private hideLegacyPurchaseButtons(): void {
        if (this.redActionButton) {
            this.redActionButton.active = false;
        }
        if (this.blueActionButton) {
            this.blueActionButton.active = false;
        }
        if (this.purpleActionButton) {
            this.purpleActionButton.active = false;
        }
    }

    private enterGame(): void {
        if (this.isLoadingGame) {
            return;
        }

        this.isLoadingGame = true;
        director.loadScene('Main');
    }

    private enterWoodJump(): void {
        if (this.isLoadingGame) {
            return;
        }

        this.isLoadingGame = true;
        director.loadScene('WoodJump');
    }

    private openShop(): void {
        if (!this.shopPanel) {
            return;
        }

        this.shopPanel.active = true;
        if (this.button) {
            this.button.active = false;
        }
        if (this.shopButton) {
            this.shopButton.active = false;
        }
        if (this.woodJumpButton) {
            this.woodJumpButton.active = false;
        }
        if (this.bird) {
            this.bird.active = false;
        }
        this.refreshShopUi('');
    }

    private closeShop(): void {
        if (this.shopPanel) {
            this.shopPanel.active = false;
        }
        if (this.button) {
            this.button.active = true;
        }
        if (this.shopButton) {
            this.shopButton.active = true;
        }
        if (this.woodJumpButton) {
            this.woodJumpButton.active = true;
        }
        if (this.bird) {
            this.bird.active = true;
            this.refreshStartBirdFrame();
        }
    }

    private handleSkinAction(id: BirdSkinId): void {
        if (this.ownedBirds.has(id)) {
            this.selectBird(id);
            this.refreshShopUi('已选择');
            return;
        }

        const skin = this.getShopSkin(id);
        const price = skin ? skin.price : this.birdPrice;
        if (this.coinBalance < price) {
            this.refreshShopUi('');
            this.showNotEnoughToast();
            return;
        }

        this.coinBalance -= price;
        this.ownedBirds.add(id);
        this.saveCoinBalance();
        this.saveOwnedBirds();
        this.selectBird(id);
        this.refreshShopUi('购买成功');
    }

    private selectBird(id: BirdSkinId): void {
        this.selectedBird = id;
        sys.localStorage.setItem(this.selectedBirdKey, id);
        this.refreshStartBirdFrame();
    }

    private refreshStartBirdFrame(): void {
        this.birdFrameIndex = 0;
        this.birdAnimTimer = 0;
        this.setSpriteFrame(this.bird, this.getSelectedBirdFrames()[0] || this.birdFrames[0] || null);
    }

    private refreshShopUi(message: string): void {
        if (this.coinBalanceLabel) {
            this.coinBalanceLabel.string = `金币 ${this.coinBalance}`;
        }
        if (this.shopMessageLabel) {
            this.shopMessageLabel.string = message;
        }

        for (const skin of this.getShopSkins()) {
            const owned = this.ownedBirds.has(skin.id);
            if (skin.priceLabel) {
                skin.priceLabel.string = owned ? '0' : String(skin.price);
            }
            if (skin.selectedMark) {
                skin.selectedMark.active = this.selectedBird === skin.id;
            }
        }
    }

    private showNotEnoughToast(): void {
        const toast = this.getOrCreateNotEnoughToast();
        if (!toast) {
            return;
        }

        const opacity = toast.getComponent(UIOpacity) || toast.addComponent(UIOpacity);
        Tween.stopAllByTarget(opacity);
        opacity.opacity = 255;
        toast.active = true;
        toast.setSiblingIndex(toast.parent ? toast.parent.children.length - 1 : 0);

        tween(opacity)
            .delay(0.45)
            .to(0.75, { opacity: 0 })
            .call(() => {
                toast.active = false;
            })
            .start();
    }

    private getOrCreateNotEnoughToast(): Node | null {
        if (this.notEnoughToast?.isValid) {
            return this.notEnoughToast;
        }
        if (!this.shopPanel) {
            return null;
        }

        const toast = new Node('NotEnoughToast');
        toast.layer = this.shopPanel.layer;
        toast.setParent(this.shopPanel);
        toast.setPosition(0, -80, 0);

        const transform = toast.addComponent(UITransform);
        transform.setContentSize(520, 88);

        const opacity = toast.addComponent(UIOpacity);
        opacity.opacity = 0;

        const background = toast.addComponent(Graphics);
        background.fillColor = new Color(18, 72, 76, 178);
        background.roundRect(-260, -44, 520, 88, 18);
        background.fill();

        const labelNode = new Node('NotEnoughToastLabel');
        labelNode.layer = toast.layer;
        labelNode.setParent(toast);

        const labelTransform = labelNode.addComponent(UITransform);
        labelTransform.setContentSize(520, 88);

        const label = labelNode.addComponent(Label);
        label.string = '金币不够！';
        label.fontSize = 42;
        label.lineHeight = 50;
        label.isBold = true;
        label.color = new Color(255, 255, 255, 255);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;

        toast.active = false;
        this.notEnoughToast = toast;
        return toast;
    }

    private loadShopState(): void {
        this.coinBalance = Number.parseInt(sys.localStorage.getItem(this.coinScoreKey) || '0', 10) || 0;
        this.ownedBirds = new Set<BirdSkinId>(['default']);

        const rawOwnedBirds = sys.localStorage.getItem(this.ownedBirdsKey);
        if (rawOwnedBirds) {
            try {
                const parsed = JSON.parse(rawOwnedBirds);
                if (Array.isArray(parsed)) {
                    for (const id of parsed) {
                        if (this.isBirdSkinId(id)) {
                            this.ownedBirds.add(id);
                        }
                    }
                }
            } catch {
                this.ownedBirds = new Set<BirdSkinId>(['default']);
            }
        }

        const rawSelectedBird = sys.localStorage.getItem(this.selectedBirdKey);
        this.selectedBird = this.isBirdSkinId(rawSelectedBird) && this.ownedBirds.has(rawSelectedBird) ? rawSelectedBird : 'default';
        this.saveOwnedBirds();
        sys.localStorage.setItem(this.selectedBirdKey, this.selectedBird);
    }

    private saveOwnedBirds(): void {
        sys.localStorage.setItem(this.ownedBirdsKey, JSON.stringify(Array.from(this.ownedBirds)));
    }

    private saveCoinBalance(): void {
        sys.localStorage.setItem(this.coinScoreKey, String(this.coinBalance));
    }

    private isBirdSkinId(value: unknown): value is BirdSkinId {
        return value === 'default' || value === 'red' || value === 'blue' || value === 'purple';
    }

    private getShopSkins(): BirdSkinConfig[] {
        return [
            {
                id: 'default',
                frames: this.birdFrames,
                preview: this.defaultBirdPreview,
                priceLabel: this.defaultPriceLabel,
                selectedMark: this.defaultSelectedMark,
                price: 0,
            },
            {
                id: 'red',
                frames: this.redBirdFrames,
                preview: this.redBirdPreview,
                priceLabel: this.redPriceLabel,
                selectedMark: this.redSelectedMark,
                price: this.birdPrice,
            },
            {
                id: 'blue',
                frames: this.blueBirdFrames,
                preview: this.blueBirdPreview,
                priceLabel: this.bluePriceLabel,
                selectedMark: this.blueSelectedMark,
                price: this.birdPrice,
            },
            {
                id: 'purple',
                frames: this.purpleBirdFrames,
                preview: this.purpleBirdPreview,
                priceLabel: this.purplePriceLabel,
                selectedMark: this.purpleSelectedMark,
                price: this.birdPrice,
            },
        ];
    }

    private getShopSkin(id: BirdSkinId): BirdSkinConfig | null {
        for (const skin of this.getShopSkins()) {
            if (skin.id === id) {
                return skin;
            }
        }
        return null;
    }

    private getSelectedBirdFrames(): SpriteFrame[] {
        if (this.selectedBird === 'red' && this.redBirdFrames.length > 0) {
            return this.redBirdFrames;
        }
        if (this.selectedBird === 'blue' && this.blueBirdFrames.length > 0) {
            return this.blueBirdFrames;
        }
        if (this.selectedBird === 'purple' && this.purpleBirdFrames.length > 0) {
            return this.purpleBirdFrames;
        }
        return this.birdFrames;
    }

    private setSpriteFrame(node: Node | null, frame: SpriteFrame | null): void {
        if (!node || !frame) {
            return;
        }

        const sprite = node.getComponent(Sprite);
        if (sprite) {
            sprite.spriteFrame = frame;
        }
    }

    private updateContentFit(): void {
        const visibleSize = view.getVisibleSize();
        if (this.background) {
            const backgroundScale = Math.max(visibleSize.width / 288, visibleSize.height / 512);
            this.background.setScale(backgroundScale, backgroundScale, 1);
            this.background.setPosition(0, 0, 0);
        }

        if (!this.contentRoot || this.contentRoot === this.node) {
            return;
        }

        const fitScale = Math.min(visibleSize.width / this.designWidth, visibleSize.height / this.designHeight);
        this.contentRoot.setScale(fitScale, fitScale, 1);
        this.contentRoot.setPosition(0, 0, 0);
    }

    private updateBird(deltaTime: number): void {
        if (!this.bird || !this.bird.active) {
            return;
        }

        const frames = this.getSelectedBirdFrames();
        this.elapsedTime += deltaTime;
        this.birdAnimTimer += deltaTime;
        if (frames.length > 0 && this.birdAnimTimer >= this.birdFrameInterval) {
            this.birdAnimTimer = 0;
            this.birdFrameIndex = (this.birdFrameIndex + 1) % frames.length;
            this.setSpriteFrame(this.bird, frames[this.birdFrameIndex]);
        }

        const floatPhase = (this.elapsedTime / this.birdFloatDuration) * Math.PI * 2;
        this.bird.setPosition(this.bird.position.x, this.birdBaseY + Math.sin(floatPhase) * this.birdFloatAmplitude, this.bird.position.z);
    }

    private getLabelByPath(path: string): Label | null {
        return this.getNodeByPath(path)?.getComponent(Label) || null;
    }

    private getNodeByPath(path: string): Node | null {
        let current: Node | null = this.contentRoot || this.node;
        for (const name of path.split('/')) {
            current = current?.getChildByName(name) || null;
            if (!current) {
                return null;
            }
        }
        return current;
    }
}
