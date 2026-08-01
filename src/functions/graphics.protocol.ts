import sharp from "sharp";
import supportsTerminalGraphics from "supports-terminal-graphics";
import supportsColor from "supports-color";
import type {
   WSZ,
   IMGSZ,
   TankoTermImgInput,
   StructImgPosition,
   TankoTermImgOutput,
   TermImgProtocolInput,
   TermImgProtocolOutput,
   StructImgPositionProtocol
} from "../types/types.ts";
import { TerminalControl } from "./reader.ts";


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
   static scaleImg(imgWidth: number, imgHeight: number, windowSize: WSZ): IMGSZ {
      //?https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/object-fit

      const ratio = [imgWidth / imgHeight, windowSize.w_width / windowSize.w_height]
      const scaleFactor = Math.min(windowSize.w_width / imgWidth, windowSize.w_height / imgHeight)
      const newImgSize = [Math.floor(imgWidth * scaleFactor), Math.floor(imgHeight * scaleFactor)]

      return {
         img_originalWidth: imgWidth,
         img_originalHeight: imgHeight,
         img_ratio: ratio[0],
         img_pixelWidth: newImgSize[0],
         img_pixelHeigth: newImgSize[1],
         img_cellsWidth: Math.floor(newImgSize[0] / windowSize.w_cellPxWidth),
         img_cellsHeigth: Math.floor(newImgSize[1] / windowSize.w_cellPxHeight)
      }
   }
   static async make({ wsz, buffer, position, forceAscii = false}: TankoTermImgInput): Promise<TankoTermImgOutput> {
      const {data:imgBuffer, info: imgInfo} =  await sharp(buffer, { failOn: 'error', sequentialRead: false })
         .toColorspace('srgb')
         .raw()
         .toBuffer({ resolveWithObject: true })
      const imgFit: IMGSZ = this.scaleImg(imgInfo.width, imgInfo.height, wsz)
      const imgPosition = this.calcPosition(position, imgFit, wsz)
      const input: TermImgProtocolInput = {
         wsz: wsz,
         imgsz: imgFit,
         position: imgPosition,
      }
      const output: TankoTermImgOutput = {
         wsz: wsz,
         imgsz: imgFit,
         buffer: imgBuffer,
         position: imgPosition,
         data: { 
            id: -1,
            encodedImg: ''
         }
      }

      if (supportsTerminalGraphics.stdout.kitty && !forceAscii) {
         output.data = kitty(imgBuffer, input)
      }
      else{
         output.data = ascii(imgBuffer, input)
      }
      return output
   }
   static remaster(buffer: Buffer<ArrayBufferLike> | ArrayBuffer, position: StructImgPosition, imgsz: IMGSZ, wsz: WSZ, forceAscii = false): TankoTermImgOutput {
      const imgFit: IMGSZ = this.scaleImg(imgsz.img_originalWidth, imgsz.img_originalHeight, wsz)
      const imgPosition = this.calcPosition(position, imgFit, wsz)
      const input: TermImgProtocolInput = {
         wsz: wsz,
         imgsz: imgFit,
         position: imgPosition,
      }
      const output: TankoTermImgOutput = {
         wsz: wsz,
         imgsz: imgFit,
         buffer: buffer,
         position: imgPosition,
         data: {
            id: -1,
            encodedImg: ''
         }
      }
      if (supportsTerminalGraphics.stdout.kitty && !forceAscii) {
         output.data = kitty(buffer, input)
      }
      else{
         output.data = ascii(buffer, input)
      }
      return output
   }
}

function kitty(buffer: Buffer<ArrayBufferLike> | ArrayBuffer , {imgsz, wsz}: TermImgProtocolInput): TermImgProtocolOutput {
   const base64 = buffer.toString('base64')
   const id = Math.floor((Math.random() * 1000) + 1)
   let outputImg: string = ''

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
         outputImg += (`\u001B_G${format},i=${id},q=2,${controlData},m=${mode};${chunk}\u001B\\`)
      } else {
         outputImg += (`\u001B_Gm=${mode},q=2;${chunk}\u001B\\`)
      }
   }
   return {
      id: id,
      encodedImg: outputImg,
   }
}
function ascii(buffer: Buffer<ArrayBufferLike> | ArrayBuffer, { imgsz, position }: TermImgProtocolInput): TermImgProtocolOutput {
   const pixelArr = new Uint8ClampedArray(buffer)
   const pixelJump = ((imgsz.img_originalWidth / imgsz.img_cellsWidth) | 0) * 3
   const rowjumps = imgsz.img_originalWidth * ((imgsz.img_originalHeight / imgsz.img_cellsHeigth) | 0) * 3

   const lines:string[] = new Array(imgsz.img_cellsHeigth)
   let pixelOffset = 0;

   for(let y = 0; y < imgsz.img_cellsHeigth; pixelOffset = rowjumps*y,y++){
      let line = ''
      line+=`\x1B[${position.y + y +1};0f\x1B[${position.x}C`
      for(let x = 0; x < imgsz.img_cellsWidth; x++, pixelOffset+= pixelJump){
         let index = pixelOffset | 0

         let R = pixelArr[index]
         let G = pixelArr[index+1]
         let B = pixelArr[index+2]

         //@ts-ignore
         if(supportsColor.stdout.has16m){
            line+= `\x1B[48;2;${R};${G};${B}m\x1B[38;2;${R};${G};${B}m\u{2584}\x1B[39;49m`
         }else{
            let luminance =( 0.299 * R + 0.587 * G + 0.114 * B)|0
            let grayScale = 232 + (((luminance*24)/256)|0)
            line+=`\x1B[48;5;${grayScale}m\x1B[38;5;${grayScale}m\u{2584}\x1B\x1B[39;49m`
         }
         line
      }
      lines[y] = line
   }
   return {
      encodedImg: lines.join('\x1B[1E'),
      id: -1
   }
}

// function sixel(buffer: Buffer<ArrayBufferLike> | ArrayBuffer, { imgsz }: TermImgProtocolInput) {
//    /*
//    ?reference
//    https://www.vt100.net/docs/vt3xx-gp/chapter14.html
//    */
//    const buff = new Uint8ClampedArray(buffer)
//    console.log(buff.length/3/320)

//    return
//    /*"Pan;Pad;Ph;Pv */
//    const raster = `"2;1;${imgsz.img_originalWidth};${imgsz.img_originalHeight}`
//    /*
//      # 	Pc 	; 	Pu; 	Px; 	Py; 	Pz
//      2/3 	** 	3/11 	** 	** 	** 	**
//    */
//    const color = `0;2;0;0;0`
//    //DCS P1;P2;raster;q s..s ST
//    let sequence = `\x1B0;0;${raster};#${color};q${buff}\x1B\\`
//    process.stdout.write(sequence)
// }


/*
const wsz = await TerminalControl.getWindowDimension() as WSZ
const buffer = '/home/alexdev/Documents/js-projects/Tanko/images/example.jpg'
const img = await TermImageGraphics.make({buffer: buffer, wsz ,position: {
   x: 'center',
   y: 'top',
   padding: {
      top: 10
   }
}})


process.stdout.write(img.data.encodedImg)*/
//const remake = TankoTerminalImg.remake(img.data.rawBuffer as Buffer, {x: 'center', y:'center'}, img.imgsz, wsz)
//process.stdout.write(remake.data.encodedImg)




