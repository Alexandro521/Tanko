import sharp, { type SharpInput } from "sharp";
import supportsTerminalGraphics from "supports-terminal-graphics";
import supportsColor from "supports-color";
import type {
   WSZ,
   IMGSZ,
   TankoTermImgInput,
   StructImgPosition,
   TankoTermImgOutput,
   TermImgProtocolInput,
   StructImgPositionProtocol,
   ObjectFit
} from "../types/types.ts";
import ansi from "ansi-escapes";

export class TermImageGraphics {
   private constructor() { }

   static calcPosition(
      position: StructImgPosition,
      { img_cellsHeigth, img_cellsWidth }: IMGSZ,
      { w_colums, w_rows, w_position_x, w_position_y }: WSZ
      ): StructImgPositionProtocol {
   
      let posX = 0, posY = 0
      const padding = {
         top: position.padding?.top ?? 0,
         bottom: position.padding?.bottom ?? 0,
         left: position.padding?.left ?? 0,
         right: position.padding?.right ?? 0,
      }
   
      switch (position.x) {
         case 'center':
            posX = (w_colums - img_cellsWidth) >> 1
            break
         case 'left':
            posX += padding.left
            break
         case 'right':
            posX = ( w_colums - img_cellsWidth - padding.right )
            break
      }
      switch (position.y) {
         case 'center':
            posY = (w_rows/2 - img_cellsHeigth/2)
            break
         case 'top':
            posY += padding.top
            break
         case 'bottom':
            posY = w_rows - img_cellsHeigth - padding.bottom
            break
      }
      return { x: Math.floor(posX + w_position_x)|0, y: Math.floor(posY + w_position_y) }
   }
   static scaleImg(imgWidth: number, imgHeight: number, windowSize: WSZ, fit: ObjectFit): IMGSZ {
      //?https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/object-fit

      const imgRatio = imgWidth / imgHeight
      let scaleFactor = 1
      if(fit === 'contain'){
         scaleFactor = Math.min(windowSize.w_width / imgWidth, windowSize.w_height / imgHeight)
      }else if(fit === 'cover'){
         scaleFactor = Math.max(windowSize.w_width / imgWidth, windowSize.w_height / imgHeight)
      }
      const newImgSize = [Math.floor(imgWidth * scaleFactor), Math.floor(imgHeight * scaleFactor)]



      return {
         img_originalWidth: imgWidth,
         img_originalHeight: imgHeight,
         img_ratio: imgRatio,
         img_pixelWidth: newImgSize[0],
         img_pixelHeigth: newImgSize[1],
         img_cellsWidth: Math.floor(newImgSize[0] / windowSize.w_cellPxWidth),
         img_cellsHeigth: Math.floor(newImgSize[1] / windowSize.w_cellPxHeight)
      }
   }

   static async make(buffer: SharpInput, { wsz, position, forceAscii = false, imageFit = 'contain'}: TankoTermImgInput): Promise<TankoTermImgOutput> {
      let imgsrgb  = sharp(buffer, { failOn: 'error', sequentialRead: false }).toColorspace('srgb')
      const metadata = await imgsrgb.metadata()
      const $ = supportsTerminalGraphics.stdout
      const scale: IMGSZ = this.scaleImg(metadata.width, metadata.height, wsz, imageFit)
      const imgPosition = this.calcPosition(position, scale, wsz)
      const input: TermImgProtocolInput = {
         wsz: wsz,
         imgsz: scale,
         position: imgPosition,
      }
      const output: TankoTermImgOutput = {
         wsz: wsz,
         imgsz: scale,
         encodedImg: '',
         position: imgPosition,
      }

      if ($.kitty && !forceAscii) {
         const imgBuffer = await imgsrgb.raw().toBuffer()
         const base64 = imgBuffer.toString('base64')
         output.encodedImg = this.kitty(base64, input)
      }
      else if ($.iterm2 && !forceAscii) {

         const imgBuffer =
         metadata.format === 'webp' ? 
         await imgsrgb.jpeg().toBuffer():
         imgsrgb.toBuffer()
         
         const base64 = imgBuffer.toString('base64')
         output.encodedImg = this.iterm2(base64, input)
      }
      else if ($.sixel && !forceAscii) {
         const imgBuffer = await imgsrgb
         .resize(scale.img_pixelWidth, scale.img_pixelHeigth)
         .raw()
         .toBuffer()
         output.encodedImg  =  this.sixel(imgBuffer, input)
      }
      else {
         const imgBuffer = await imgsrgb
         .resize(scale.img_pixelWidth, scale.img_pixelHeigth)
         .raw()
         .toBuffer()
         output.encodedImg = this.ascii(imgBuffer, input)
      }
      return output
   }
   static kitty(base64: string, { imgsz, wsz, position }: TermImgProtocolInput) {
      const id = Math.floor((Math.random() * 1000) + 1)
      let kittySequence: string = ansi.cursorTo(position.x, position.y)
      let format = `f=24,s=${imgsz.img_originalWidth},v=${imgsz.img_originalHeight}`
      let controlData = `a=T`
      if (imgsz.img_ratio < wsz.w_ratio) {
         controlData += `,r=${imgsz.img_cellsHeigth}`
      } else if (imgsz.img_ratio > wsz.w_ratio) {
         controlData += `,c=${imgsz.img_cellsWidth}`
      } else {
         controlData += `,r=${imgsz.img_cellsHeigth},c=${imgsz.img_cellsWidth}`
      }
      for (let i = 0; i < base64.length; i += 4096) {
         const chunk = base64.slice(i, i + 4096);
         const isLast = (i + 4096) >= base64.length
         const mode = isLast ? 0 : 1
         if (i === 0) {
            kittySequence += (`\u001B_G${format},q=2,${controlData},m=${mode};${chunk}\u001B\\`)
         } else {
            kittySequence += (`\u001B_Gm=${mode},q=2;${chunk}\u001B\\`)
         }
      }
      return kittySequence
   }
   static ascii(buffer: Buffer, { imgsz, position }: TermImgProtocolInput) {
      const pixelArr = new Uint8ClampedArray(buffer)
      const pixelJump = ((imgsz.img_pixelWidth / imgsz.img_cellsWidth) | 0) * 3
      const rowjumps = imgsz.img_pixelWidth * ((imgsz.img_pixelHeigth / imgsz.img_cellsHeigth) | 0) * 3

      const lines: string[] = new Array(imgsz.img_cellsHeigth)
      let pixelOffset = 0;

      for (let y = 0; y < imgsz.img_cellsHeigth; pixelOffset = rowjumps * y, y++) {
         let line = ''
         line += `\x1B[${position.y + y + 1};0f\x1B[${position.x}C`
         for (let x = 0; x < imgsz.img_cellsWidth; x++, pixelOffset += pixelJump) {
            let index = pixelOffset | 0

            let R = pixelArr[index]
            let G = pixelArr[index + 1]
            let B = pixelArr[index + 2]

            //@ts-ignore
            if (supportsColor.stdout.has16m) {
               line += `\x1B[48;2;${R};${G};${B}m\x1B[38;2;${R};${G};${B}m\u{2584}\x1B[39;49m`
            } else {
               let luminance = (0.299 * R + 0.587 * G + 0.114 * B) | 0
               let grayScale = 232 + (((luminance * 24) / 256) | 0)
               line += `\x1B[48;5;${grayScale}m\x1B[38;5;${grayScale}m\u{2584}\x1B\x1B[39;49m`
            }
         }
         lines[y] = line
      }
      return lines.join('\x1B[1E')
   }
   static sixel(buffer: Buffer, { imgsz }: TermImgProtocolInput) {
      /*
      https://en.wikipedia.org/wiki/Sixel
      https://www.vt100.net/docs/vt3xx-gp/chapter14.html
      https://www.digiater.nl/openvms/decus/vax90b1/krypton-nasa/all-about-sixels.text
      */
      const pixelArr = new Uint8ClampedArray(buffer)
      let imgWidth = imgsz.img_pixelWidth
      let imgHeight = imgsz.img_pixelHeigth
      let sixelImgEncoded = ''
      let grayScaleRegister = ''
      for (let i = 0; i < 100; i++) {
         grayScaleRegister += `#${i};2;${(i)};${i};${i};`
      }

      for (let y = 0, i = 0; y < imgHeight; y += 6, i++) {
         const imageRowIndex = y * imgWidth * 3
         for (let x = 0; x < imgWidth; x++) {
            let pixelColumnOffset = imageRowIndex + (x * 3)
            //let sixelInt = 0x3F
            let lumen = 0
            for (let sixelRow = 0; sixelRow < 6; sixelRow++) {
               const absolutePixelIndex = (imgWidth * sixelRow * 3) + pixelColumnOffset
               //aproximation
               let luminance = (
                  299 * pixelArr[absolutePixelIndex] +  //RED
                  587 * pixelArr[absolutePixelIndex + 1] + //GREEN
                  114 * pixelArr[absolutePixelIndex + 2]) //BLUE
                  >> 10
               lumen += (luminance * 100) >> 8
            }
            sixelImgEncoded += `#${(lumen / 6) | 0};~`
         }
         sixelImgEncoded += '-'
      }
      /*"Pan;Pad;Ph;Pv */
      const raster = `"2;1;${imgWidth};${imgHeight}`
      const scrollingModeEnabled = '\x1BP?80h'
      const scrollingModeDisabled = '\x1BP?80l'
      let sixelSequence = `${scrollingModeEnabled}\x1BP0;0;0;q${raster};${grayScaleRegister}${sixelImgEncoded}\x1B\\${scrollingModeDisabled}`
      return sixelSequence
   }
   static iterm2(base64: string, { imgsz, position }: TermImgProtocolInput) {
      const dimensions = `width=${imgsz.img_pixelWidth}px;height=${imgsz.img_pixelHeigth}px;preserveAspectRatio=1`
      let startSequence = `${ansi.cursorTo(position.x, position.y)}\x1B]1337;File=${dimensions};inline=1:${base64}\x1B\\`
      return startSequence
   }
}