import sharp from "sharp";
import supportsTerminalGraphics from "supports-terminal-graphics";
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
   
      return { x: posX + w_position_x, y: posY + w_position_y }
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
   static async make({ wsz, buffer, position}: TankoTermImgInput): Promise<TankoTermImgOutput> {
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

      if (supportsTerminalGraphics.stdout.kitty) {
         output.data = kitty(imgBuffer, input)
      }
      return output
   }
   static remaster(buffer: Buffer<ArrayBufferLike> | ArrayBuffer, position: StructImgPosition, imgsz: IMGSZ, wsz: WSZ): TankoTermImgOutput {
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
      if (supportsTerminalGraphics.stdout.kitty) {
         output.data = kitty(buffer ,input)
      }
      return output
   }
}

export function kitty(buffer: Buffer<ArrayBufferLike> | ArrayBuffer , {imgsz, wsz}: TermImgProtocolInput): TermImgProtocolOutput {
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

/*
const wsz = await TerminalControl.getWindowDimension() as WSZ
const res = await fetch('https://cmdxd98sb0x3yprd.mangadex.network/data/df57f7104f467bc1683c5d7590b23ba9/1-1e1409d9c16ee6cc3ba92f45a51aba01d3f14177fff64435b8527aab3f600358.jpg')
const buffer = await res.arrayBuffer()

const img = await TankoTerminalImg.make({buffer: buffer, wsz ,position: {
   x: 'left',
   y: 'top'
}})

//process.stdout.write(img.data.encodedImg)
//const remake = TankoTerminalImg.remake(img.data.rawBuffer as Buffer, {x: 'center', y:'center'}, img.imgsz, wsz)
//process.stdout.write(remake.data.encodedImg)
*/



