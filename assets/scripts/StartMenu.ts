import {
    _decorator,
    Color,
    Component,
    director,
    Label,
    Node,
    Sprite,
    SpriteFrame,
    UITransform,
    view,
} from 'cc';

const { ccclass, property } = _decorator;

@ccclass('StartMenu')
export class StartMenu extends Component {
    @property(Node)
    public background: Node | null = null;

    @property(Node)
    public bird: Node | null = null;

    @property(Node)
    public button: Node | null = null;

    @property(Label)
    public buttonLabel: Label | null = null;

    @property(SpriteFrame)
    public buttonNormalFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public buttonPressedFrame: SpriteFrame | null = null;

    @property([SpriteFrame])
    public birdFrames: SpriteFrame[] = [];

    private screenWidth = 0;
    private screenHeight = 0;
    private birdAnimTimer = 0;
    private birdFrameIndex = 0;
    private elapsedTime = 0;
    private isButtonPressed = false;
    private isLoadingGame = false;
    private isButtonEventsBound = false;

    private readonly birdScale = 2.2;
    private readonly buttonScale = 2.4;
    private readonly birdFrameInterval = 0.12;
    private readonly birdFloatAmplitude = 18;
    private readonly birdFloatDuration = 1.5;

    protected onLoad(): void {
        this.resolveSceneNodes();
        this.refreshScreenSize();
        this.configureSceneNodes();
        this.bindButtonEvents();
    }

    protected update(deltaTime: number): void {
        this.refreshScreenSize();
        this.updateBird(deltaTime);
    }

    private resolveSceneNodes(): void {
        this.background = this.background || this.node.getChildByName('StartBackground');
        this.bird = this.bird || this.node.getChildByName('StartBird');
        this.button = this.button || this.node.getChildByName('StartButton');

        if (!this.buttonLabel && this.button) {
            this.buttonLabel = this.button.getChildByName('StartButtonLabel')?.getComponent(Label) || null;
        }
    }

    private configureSceneNodes(): void {
        if (this.background) {
            this.background.getComponent(UITransform)?.setContentSize(288, 512);
        }

        if (this.bird) {
            this.bird.getComponent(UITransform)?.setContentSize(48, 48);
            this.bird.setScale(this.birdScale, this.birdScale, 1);
            const birdSprite = this.bird.getComponent(Sprite);
            if (birdSprite && this.birdFrames[0]) {
                birdSprite.spriteFrame = this.birdFrames[0];
            }
        }

        if (this.button) {
            this.button.getComponent(UITransform)?.setContentSize(142, 64);
            this.button.setScale(this.buttonScale, this.buttonScale, 1);
            this.setButtonFrame(this.buttonNormalFrame);
        }

        if (this.buttonLabel) {
            this.buttonLabel.node.getComponent(UITransform)?.setContentSize(320, 90);
            this.buttonLabel.node.setPosition(0, 2, 0);
            this.buttonLabel.string = '跃动小鸟';
            this.buttonLabel.fontSize = 42;
            this.buttonLabel.lineHeight = 48;
            this.buttonLabel.color = Color.WHITE;
            this.buttonLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            this.buttonLabel.verticalAlign = Label.VerticalAlign.CENTER;
        }

        this.layoutScene();
    }

    private bindButtonEvents(): void {
        if (this.isButtonEventsBound) {
            return;
        }

        if (!this.button) {
            console.warn('StartMenu: StartButton node is missing.');
            return;
        }

        this.button.on(Node.EventType.TOUCH_START, this.onButtonDown, this);
        this.button.on(Node.EventType.TOUCH_END, this.onButtonUp, this);
        this.button.on(Node.EventType.TOUCH_CANCEL, this.onButtonCancel, this);
        this.button.on(Node.EventType.MOUSE_DOWN, this.onButtonDown, this);
        this.button.on(Node.EventType.MOUSE_UP, this.onButtonUp, this);
        this.isButtonEventsBound = true;
    }

    private unbindButtonEvents(): void {
        if (!this.button || !this.isButtonEventsBound) {
            return;
        }

        this.button.off(Node.EventType.TOUCH_START, this.onButtonDown, this);
        this.button.off(Node.EventType.TOUCH_END, this.onButtonUp, this);
        this.button.off(Node.EventType.TOUCH_CANCEL, this.onButtonCancel, this);
        this.button.off(Node.EventType.MOUSE_DOWN, this.onButtonDown, this);
        this.button.off(Node.EventType.MOUSE_UP, this.onButtonUp, this);
        this.isButtonEventsBound = false;
    }

    private onButtonDown(): void {
        if (this.isLoadingGame) {
            return;
        }

        this.isButtonPressed = true;
        this.setButtonFrame(this.buttonPressedFrame || this.buttonNormalFrame);
    }

    private onButtonUp(): void {
        if (!this.isButtonPressed || this.isLoadingGame) {
            return;
        }

        this.isButtonPressed = false;
        this.isLoadingGame = true;
        this.setButtonFrame(this.buttonNormalFrame);
        this.unbindButtonEvents();
        director.loadScene('Main');
    }

    private onButtonCancel(): void {
        this.isButtonPressed = false;
        this.setButtonFrame(this.buttonNormalFrame);
    }

    private setButtonFrame(frame: SpriteFrame | null): void {
        if (!this.button || !frame) {
            return;
        }

        const sprite = this.button.getComponent(Sprite);
        if (sprite) {
            sprite.spriteFrame = frame;
        }
    }

    private updateBird(deltaTime: number): void {
        if (!this.bird) {
            return;
        }

        this.elapsedTime += deltaTime;
        this.birdAnimTimer += deltaTime;
        if (this.birdFrames.length > 0 && this.birdAnimTimer >= this.birdFrameInterval) {
            this.birdAnimTimer = 0;
            this.birdFrameIndex = (this.birdFrameIndex + 1) % this.birdFrames.length;
            const sprite = this.bird.getComponent(Sprite);
            if (sprite) {
                sprite.spriteFrame = this.birdFrames[this.birdFrameIndex];
            }
        }

        const floatPhase = (this.elapsedTime / this.birdFloatDuration) * Math.PI * 2;
        const baseY = this.screenHeight * 0.18;
        this.bird.setPosition(0, baseY + Math.sin(floatPhase) * this.birdFloatAmplitude, 0);
    }

    private refreshScreenSize(): void {
        const visibleSize = view.getVisibleSize();
        const nextWidth = Math.max(1, visibleSize.width);
        const nextHeight = Math.max(1, visibleSize.height);
        const sizeChanged = Math.abs(nextWidth - this.screenWidth) > 0.5 || Math.abs(nextHeight - this.screenHeight) > 0.5;

        this.screenWidth = nextWidth;
        this.screenHeight = nextHeight;

        const transform = this.node.getComponent(UITransform);
        if (transform) {
            transform.setContentSize(this.screenWidth, this.screenHeight);
        }

        if (sizeChanged) {
            this.layoutScene();
        }
    }

    private layoutScene(): void {
        if (this.background) {
            const bgScale = Math.max(this.screenWidth / 288, this.screenHeight / 512);
            this.background.setScale(bgScale, bgScale, 1);
            this.background.setPosition(0, 0, 0);
        }

        if (this.bird) {
            this.bird.setPosition(0, this.screenHeight * 0.18, 0);
        }

        if (this.button) {
            this.button.setPosition(0, -this.screenHeight * 0.18, 0);
        }
    }
}
