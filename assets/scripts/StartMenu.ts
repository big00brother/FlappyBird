import {
    _decorator,
    Component,
    director,
    Label,
    Node,
    Sprite,
    SpriteFrame,
    sys,
    view,
} from 'cc';

const { ccclass, property } = _decorator;

type BirdSkinId = 'default' | 'red' | 'blue' | 'purple';

interface BirdSkinConfig {
    id: BirdSkinId;
    name: string;
    frames: SpriteFrame[];
    preview: Node | null;
    actionButton: Node | null;
    actionLabel: Label | null;
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

    @property(SpriteFrame)
    public buttonNormalFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public buttonPressedFrame: SpriteFrame | null = null;

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
    private readonly birdPrice = 100;
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
    private isLoadingGame = false;

    private readonly birdFrameInterval = 0.12;
    private readonly birdFloatAmplitude = 18;
    private readonly birdFloatDuration = 1.5;

    protected onLoad(): void {
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
        this.shopPanel = this.shopPanel || this.contentRoot.getChildByName('ShopPanel');

        this.buttonLabel = this.buttonLabel || this.getLabelByPath('StartButton/StartButtonLabel');
        this.shopButtonLabel = this.shopButtonLabel || this.getLabelByPath('ShopButton/ShopButtonLabel');
        this.coinBalanceLabel = this.coinBalanceLabel || this.getLabelByPath('ShopPanel/CoinBalanceLabel');
        this.shopMessageLabel = this.shopMessageLabel || this.getLabelByPath('ShopPanel/ShopMessageLabel');
        this.closeShopButton = this.closeShopButton || this.getNodeByPath('ShopPanel/CloseShopButton');
        this.closeShopLabel = this.closeShopLabel || this.getLabelByPath('ShopPanel/CloseShopButton/CloseShopLabel');

        this.redBirdPreview = this.redBirdPreview || this.getNodeByPath('ShopPanel/RedBirdPreview');
        this.blueBirdPreview = this.blueBirdPreview || this.getNodeByPath('ShopPanel/BlueBirdPreview');
        this.purpleBirdPreview = this.purpleBirdPreview || this.getNodeByPath('ShopPanel/PurpleBirdPreview');
        this.redActionButton = this.redActionButton || this.getNodeByPath('ShopPanel/RedActionButton');
        this.blueActionButton = this.blueActionButton || this.getNodeByPath('ShopPanel/BlueActionButton');
        this.purpleActionButton = this.purpleActionButton || this.getNodeByPath('ShopPanel/PurpleActionButton');
        this.redActionLabel = this.redActionLabel || this.getLabelByPath('ShopPanel/RedActionButton/RedActionLabel');
        this.blueActionLabel = this.blueActionLabel || this.getLabelByPath('ShopPanel/BlueActionButton/BlueActionLabel');
        this.purpleActionLabel = this.purpleActionLabel || this.getLabelByPath('ShopPanel/PurpleActionButton/PurpleActionLabel');
    }

    private configureSceneNodes(): void {
        if (this.bird) {
            this.birdBaseY = this.bird.position.y;
            this.setSpriteFrame(this.bird, this.getSelectedBirdFrames()[0] || this.birdFrames[0] || null);
        }

        this.configureButton(this.button, this.buttonLabel, '跃动小鸟');
        this.configureButton(this.shopButton, this.shopButtonLabel, '小鸟商店');
        this.configureButton(this.closeShopButton, this.closeShopLabel, '返回');
        this.configureButton(this.redActionButton, this.redActionLabel, '');
        this.configureButton(this.blueActionButton, this.blueActionLabel, '');
        this.configureButton(this.purpleActionButton, this.purpleActionLabel, '');

        for (const skin of this.getShopSkins()) {
            if (skin.preview) {
                this.setSpriteFrame(skin.preview, skin.frames[0] || null);
            }
        }

        if (this.shopPanel) {
            this.shopPanel.active = false;
        }

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
        this.bindButton(this.shopButton, () => this.openShop());
        this.bindButton(this.closeShopButton, () => this.closeShop());
        this.bindButton(this.redActionButton, () => this.handleSkinAction('red'));
        this.bindButton(this.blueActionButton, () => this.handleSkinAction('blue'));
        this.bindButton(this.purpleActionButton, () => this.handleSkinAction('purple'));
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

    private enterGame(): void {
        if (this.isLoadingGame) {
            return;
        }

        this.isLoadingGame = true;
        director.loadScene('Main');
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
        if (this.bird) {
            this.bird.active = true;
        }
    }

    private handleSkinAction(id: BirdSkinId): void {
        if (this.ownedBirds.has(id)) {
            this.selectBird(id);
            this.refreshShopUi('已选择');
            return;
        }

        if (this.coinBalance < this.birdPrice) {
            this.refreshShopUi('金币不足');
            return;
        }

        this.coinBalance -= this.birdPrice;
        this.ownedBirds.add(id);
        this.saveCoinBalance();
        this.saveOwnedBirds();
        this.selectBird(id);
        this.refreshShopUi('购买成功');
    }

    private selectBird(id: BirdSkinId): void {
        this.selectedBird = id;
        sys.localStorage.setItem(this.selectedBirdKey, id);
        this.birdFrameIndex = 0;
        this.setSpriteFrame(this.bird, this.getSelectedBirdFrames()[0] || null);
    }

    private refreshShopUi(message: string): void {
        if (this.coinBalanceLabel) {
            this.coinBalanceLabel.string = `金币 ${this.coinBalance}`;
        }
        if (this.shopMessageLabel) {
            this.shopMessageLabel.string = message;
        }

        for (const skin of this.getShopSkins()) {
            if (!skin.actionLabel) {
                continue;
            }

            if (this.selectedBird === skin.id) {
                skin.actionLabel.string = '已选择';
            } else if (this.ownedBirds.has(skin.id)) {
                skin.actionLabel.string = '使用';
            } else {
                skin.actionLabel.string = this.coinBalance >= this.birdPrice ? `购买 ${this.birdPrice}` : '金币不足';
            }
        }
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
                id: 'red',
                name: '红鸟',
                frames: this.redBirdFrames,
                preview: this.redBirdPreview,
                actionButton: this.redActionButton,
                actionLabel: this.redActionLabel,
            },
            {
                id: 'blue',
                name: '蓝鸟',
                frames: this.blueBirdFrames,
                preview: this.blueBirdPreview,
                actionButton: this.blueActionButton,
                actionLabel: this.blueActionLabel,
            },
            {
                id: 'purple',
                name: '紫鸟',
                frames: this.purpleBirdFrames,
                preview: this.purpleBirdPreview,
                actionButton: this.purpleActionButton,
                actionLabel: this.purpleActionLabel,
            },
        ];
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
        if (!this.contentRoot || this.contentRoot === this.node) {
            return;
        }

        const visibleSize = view.getVisibleSize();
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
