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
   ObjectFit,
   TermImgProtocolName
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
            if(img_cellsWidth >= w_colums){
               posX = 0
            }else{
               posX = (w_colums - img_cellsWidth) >> 1
            }
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
            if(img_cellsHeigth > w_rows){
               posY = 0
            }else{
               posY = (w_rows/2 - img_cellsHeigth/2)
            }
            break
         case 'top':
               posY += padding.top
            break
         case 'bottom':
            posY = w_rows - img_cellsHeigth - padding.bottom
            break
      }
      return { x: Math.floor(posX + w_position_x), y: Math.floor(posY + w_position_y) }
   }
   static scaleImg(imgWidth: number, imgHeight: number, windowSize: WSZ, fit: ObjectFit, maxWidth: number): IMGSZ {
      //?https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/object-fit

      const imgRatio = imgWidth / imgHeight
      let scaleFactor = 1
      if(fit === 'contain'){
         scaleFactor = Math.min(windowSize.w_width / imgWidth, windowSize.w_height / imgHeight)
      }else if(fit === 'cover'){
         if (imgWidth > maxWidth) {
            scaleFactor = Math.max(maxWidth / imgWidth, windowSize.w_height / imgHeight )
         }else {
            scaleFactor = Math.max(windowSize.w_width / imgWidth, windowSize.w_height / imgHeight)
         }
      }
      let [width, height] = [Math.floor(imgWidth * scaleFactor), Math.floor(imgHeight * scaleFactor)]
      
      return {
         img_originalWidth: imgWidth,
         img_originalHeight: imgHeight,
         img_ratio: imgRatio,
         img_pixelWidth: width,
         img_pixelHeigth: height,
         img_cellsWidth: Math.floor(width / windowSize.w_cellPxWidth),
         img_cellsHeigth: Math.floor(height/ windowSize.w_cellPxHeight)
      }
   }

   static async make(
      buffer: SharpInput, 
      { 
         wsz,
         position, 
         forceAscii = false, 
         imageFit = 'contain',
         forceProtocol = 'default',
         maxImgWidth
      }: TankoTermImgInput): Promise<TankoTermImgOutput> {
      let imgsrgb  = sharp(buffer, { failOn: 'error', sequentialRead: false }).toColorspace('srgb')
      const metadata = await imgsrgb.metadata()
      const $ = supportsTerminalGraphics.stdout
      const scale: IMGSZ = this.scaleImg(metadata.width, metadata.height, wsz, imageFit, maxImgWidth)
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

      let protocol: TermImgProtocolName = 'default'
      if(forceProtocol !== 'default' && $[forceProtocol as keyof typeof $] || forceProtocol === 'ascii'){
         protocol = forceProtocol;
      }else {
         protocol = ( $.kitty ? 'kitty' : ( $.iterm2 ? 'iterm2' : ($ .sixel ? 'sixel' : 'ascii')))
      }
      if(forceAscii) protocol = 'ascii'

      switch(protocol){
         case 'kitty':{
            const imgBuffer = await imgsrgb.raw().toBuffer()
            const base64 = imgBuffer.toString('base64')
            output.encodedImg = this.kitty(base64, input)
            break
         }
         case 'iterm2':{
            const imgBuffer = metadata.format === 'webp' ?
            await imgsrgb.jpeg().toBuffer() :
            await imgsrgb.toBuffer()
            const base64 = imgBuffer.toString('base64')
            output.encodedImg = this.iterm2(base64, input)
            break
         }
         case 'sixel': {
            const imgBuffer = await imgsrgb
            .removeAlpha()
            .resize(scale.img_pixelWidth, scale.img_pixelHeigth)
            .raw()
            .toUint8Array()
            output.encodedImg  =  this.sixel(imgBuffer.data, input)
            break
         }
         case 'ascii': {
            const imgBuffer = await imgsrgb
            .resize(scale.img_pixelWidth, scale.img_pixelHeigth)
            .raw()
            .toBuffer()
            output.encodedImg = this.ascii(imgBuffer, input)
            break
         }
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
   static sixel(pixelMap: Uint8Array<ArrayBufferLike>, { imgsz, position }: TermImgProtocolInput) {
      /*
      ? https://en.wikipedia.org/wiki/Sixel
      ? https://www.vt100.net/docs/vt3xx-gp/chapter14.html
      ? https://www.digiater.nl/openvms/decus/vax90b1/krypton-nasa/all-about-sixels.text
      */
    //  const pixelMap = new Uint8ClampedArray(buffer)
      const {img_pixelHeigth:imgHeight, img_pixelWidth: imgWidth} = imgsz
      
      const sixelCharVector = Array.from([
         '?', '@', 'A', 'B', 'C', 'D', 'E', 'F',
         'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N',
         'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V',
         'W', 'X', 'Y', 'Z', '[', '\\', ']', '^',
         '_', '`', 'a', 'b', 'c', 'd', 'e', 'f',
         'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n',
         'o', 'p', 'q', 'r', 's', 't', 'u', 'v',
         'w', 'x', 'y', 'z', '{', '|', '}', '~','!','?'
      ])
      const COLOR_LOOKUP = new Array(100)
      for(let i = 0; i< 100; i++)
         COLOR_LOOKUP[i] = '#'+i
      //? https://vtdn.dev/docs/graphics/sixel/#color-introduction
      const grayScaleRegister = new Array(100)
      for (let i = 0; i < 100; i++) 
         grayScaleRegister[i] = (`#${i};2;${(i)};${i};${i}`)
      
      const arrayCount = Math.floor(imgHeight/6)+1
      const sixelImgEncoded: String[] = new Array(arrayCount)
      const lastWrittenPosition = new Int32Array(6)
      const lastRegisteredColor = new Int8Array(6)
      const lastSixelWritten = new Int8Array(6)
      const concurrencyAccumulator = new Int32Array(6)
      const sixelColorRegister = new Uint8Array(100)
      const sixelMarker = new Int8Array(6)
      const passes: string[][] = [[],[],[],[],[],[]]

      for (let y = 0, i = 0; y < imgHeight; y += 6, i++) {
         lastWrittenPosition.fill(-1)
         lastRegisteredColor.fill(-1)
         lastSixelWritten.fill(-1)
         concurrencyAccumulator.fill(-1)
         for(let i =0; i<6;i++)
            passes[i].length = 0
         
         const sixelRowStartIndex = y * imgWidth * 3
         for (let x = 0; x < imgWidth; x++) {
            const sixelColumnPosition = sixelRowStartIndex + x * 3 
            sixelColorRegister.fill(0)
            sixelMarker.fill(-1)
            for (let sixelPixelIndex = 0; sixelPixelIndex < 6; sixelPixelIndex++) {
               const absolutePixelPosition = (imgWidth * sixelPixelIndex  * 3) + sixelColumnPosition
               const colorIndex = (((
                   13933 * pixelMap[absolutePixelPosition    ] //RED
                  +46871 * pixelMap[absolutePixelPosition + 1] //GREEN
                  +4732 * pixelMap[absolutePixelPosition + 2] //BLUE
               ) >> 16) * 100 )>> 8
               
               if(sixelColorRegister[colorIndex] < 1){
                  sixelMarker[sixelPixelIndex] = colorIndex
               }
               sixelColorRegister[colorIndex] |= 1 << sixelPixelIndex
            }

            for(let index = 0; index < 6; index++){
               if(sixelMarker[index] < 0) continue
               const colorIndex = sixelMarker[index]
               const sixelInt = sixelColorRegister[colorIndex]
               const sixelChar = sixelCharVector[sixelInt]
               const xDiff = x - lastWrittenPosition[index] - 1;
               if (xDiff) {
                  passes[index].push('!'+xDiff+'?')
               }
               if(lastRegisteredColor[index] !== colorIndex){
                  passes[index].push(COLOR_LOOKUP[colorIndex], sixelChar)
                  concurrencyAccumulator[index] = 1
                  lastSixelWritten[index] = sixelInt
               }
               else {
                  if(xDiff < 1 && lastSixelWritten[index] === sixelInt){
                     const sixelConcurrency = concurrencyAccumulator[index]
                     passes[index][ passes[index].length -1 ] = ('!'+(sixelConcurrency+1)+sixelChar)
                     concurrencyAccumulator[index]++
                  }else{
                     passes[index].push(sixelChar)
                     concurrencyAccumulator[index] = 1
                     lastSixelWritten[index] = sixelInt
                  }
               }
               lastRegisteredColor[index] = colorIndex
               lastWrittenPosition[index] = x
            }
         }
         sixelImgEncoded[i] =  passes.join('$')
      }
      /*"Pan;Pad;Ph;Pv */
      const raster = `"2;1;${imgWidth};${imgHeight}`
      const scrollingModeEnabled = '\x1BP?80h'
      const scrollingModeDisabled = '\x1BP?80l'
      return `${scrollingModeEnabled}${ansi.cursorTo(position.x, position.y)}\x1BP0;0;0;q${raster};${grayScaleRegister.join('')}${sixelImgEncoded.join('-')}\x1B\\${scrollingModeDisabled}`
   }

   static iterm2(base64: string, {imgsz, position}: TermImgProtocolInput) {
      const options = `width=${imgsz.img_pixelWidth}px;height=${imgsz.img_pixelHeigth};preserveAspectRatio=1;inline=1`
      const cursorPosition = ansi.cursorTo(position.x, position.y)
      return `${cursorPosition}\x1b]1337;File=${options}:${base64}\x1b\\`
   }
}