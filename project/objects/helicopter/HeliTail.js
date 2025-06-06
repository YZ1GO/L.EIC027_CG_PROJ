import { CGFobject, CGFtexture } from '../../../lib/CGF.js';
import { HeliTailCuttablePyramid } from './HeliTailCuttablePyramid.js';
import { HeliBodyRectangularPrism } from './HeliBodyRectangularPrism.js';
import { MyCylinder } from '../../primitives/MyCylinder.js';
import { MyQuad } from '../../primitives/MyQuad.js';

export class HeliTail extends CGFobject {
    constructor(scene) {
        super(scene);

        this.redMetalTexture = new CGFtexture(scene, 'textures/helicopter/red_metal.jpg');
        this.greyMetalTexture = new CGFtexture(scene, 'textures/helicopter/grey_metal.jpg');
        this.whiteMaterialTexture = new CGFtexture(scene, 'textures/helicopter/white_material.jpg');

        // Main tail
        this.mainTail = new HeliTailCuttablePyramid(scene, 2, 1, 4, 2.5, [0.5, 0.5, 0.5, 1], this.redMetalTexture);

        // Calculate dimensions for the secondary tail
        const u = (4 - 2.5) / 4; // u = 0.375
        const width = 2 * u;  // mainTail TopWidth = 0.75
        const depth = 1 * u;  // mainTail TopDepth = 0.375

        // Secondary tail
        this.secondaryTail = new HeliTailCuttablePyramid(scene, width, depth, 3, 2, [0.5, 0.5, 0.5, 1], this.redMetalTexture);

        this.tailDetailMain = new HeliBodyRectangularPrism(scene, 2, 0.25, 0.1, [0.5, 0.5, 0.5, 1], this.whiteMaterialTexture);
        this.tailDetailLeft = new HeliBodyRectangularPrism(scene, 0.5, 0.35, 0.1, [0.5, 0.5, 0.5, 1], this.redMetalTexture);
        this.tailDetailRight = new HeliBodyRectangularPrism(scene, 0.5, 0.35, 0.1, [0.5, 0.5, 0.5, 1], this.redMetalTexture);
        this.tailProppellerSupport = new MyCylinder(scene, 12, 1, [0.5, 0.5, 0.5, 1], this.greyMetalTexture, true, false);

        this.sticker = new MyQuad(scene);
        this.sticker3Texture = new CGFtexture(scene, "textures/helicopter/sticker_3.png");
    }

    display() {
        // Display the main tail
        this.scene.pushMatrix();
        this.scene.translate(0, -1, 0);
        this.scene.rotate(Math.PI, 1, 0, 0);
        this.scene.rotate(Math.PI, 0, 1, 0);
        this.scene.translate(-1, -2.60, 2.75);
        this.mainTail.display();
        this.scene.popMatrix();

        // Display the secondary tail
        this.scene.pushMatrix();
        this.scene.translate(0, -1, 0);
        this.scene.rotate(Math.PI, 1, 0, 0);
        this.scene.rotate(Math.PI, 0, 1, 0);
        this.scene.translate(-0.375, -2.60, 5.25);
        this.secondaryTail.display();
        this.scene.popMatrix();

        // Display the tail detail
        this.scene.pushMatrix();
        this.scene.translate(-1, 1.4, 5.25);
        this.tailDetailMain.display();
        this.scene.popMatrix();

        this.scene.pushMatrix();
        this.scene.translate(0, -1, 0);
        this.scene.rotate(Math.PI / 2, 0, 0, 1);
        this.scene.translate(2.20, 1.01, 5.20);
        this.tailDetailLeft.display();
        this.scene.popMatrix();

        this.scene.pushMatrix();
        this.scene.translate(0, -1, 0);
        this.scene.rotate(Math.PI / 2, 0, 0, 1);
        this.scene.translate(2.20, -1.01, 5.20);
        this.tailDetailRight.display();
        this.scene.popMatrix();

        // Display the tail propeller support
        this.scene.pushMatrix();
        this.scene.translate(0, -1, 0);
        this.scene.rotate(-Math.PI / 2, 0, 0, 1);
        this.scene.scale(0.06, 0.27, 0.06);
        this.scene.translate(-42, 0, 118);
        this.tailProppellerSupport.display();
        this.scene.popMatrix();

        // Sticker
        this.scene.gl.enable(this.scene.gl.BLEND);
        this.scene.gl.blendFuncSeparate(this.scene.gl.SRC_ALPHA, this.scene.gl.ONE_MINUS_SRC_ALPHA, this.scene.gl.ONE, this.scene.gl.ONE);
        this.scene.gl.depthMask(false);

        this.scene.pushMatrix();
        this.scene.scale(0.5, 0.5, 0.5);
        this.scene.rotate(Math.PI / 2, 0, 1, 0);
        this.scene.translate(-7.3, 2.4, 1.56);
        this.scene.rotate(-Math.PI / 13, 0, 1, 0);
        this.scene.rotate(-Math.PI / 30, 0, 0, 1);
        this.scene.scale(3, 1, 1);
        this.sticker3Texture.bind();
        this.sticker.display();
        this.sticker3Texture.unbind();
        this.scene.popMatrix();

        this.scene.pushMatrix();
        this.scene.scale(0.5, 0.5, 0.5);
        this.scene.rotate(-Math.PI / 2, 0, 1, 0);
        this.scene.translate(7.3, 2.4, 1.56);
        this.scene.rotate(Math.PI / 13, 0, 1, 0);
        this.scene.rotate(Math.PI / 30, 0, 0, 1);
        this.scene.scale(3, 1, 1);
        this.sticker3Texture.bind();
        this.sticker.display();
        this.sticker3Texture.unbind();
        this.scene.popMatrix();

        this.scene.gl.depthMask(true);
        this.scene.gl.disable(this.scene.gl.BLEND);
    }
}