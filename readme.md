# Dokusha CLI

Dokusha es una pequeña app de terminal para leer y descargar mangas de forma simple y directa.

![yomu preview](https://i.imgur.com/UQEyaIp.png)
![yomu preview](https://i.imgur.com/lsytDnf.png)
![yomu preview](https://i.imgur.com/NnzVGXz.gif)
![yomu preview](https://imgur.com/ZkChhZ1.gif)

## 1. Instalar dokusha

### npm

```bash
npm install -g dokusha
```

### pnpm

```bash
pnpm add -g dokusha
```

### bun

```bash
bun add -g dokusha
```

### 2. Instalar navegador Firefox

```bash
npx playwright install firefox
```

### 3. Ejecutar dokusha

```bash
dokusha
```

> [!IMPORTANT]
> **Experiencia Visual:** Para disfrutar del manga con imágenes reales, se recomienda usar una terminal con soporte para protocolos de imagen.

### 🚀 Terminales Recomendadas para Dokusha

Para una experiencia óptima con imágenes en alta resolución, utiliza una terminal que soporte protocolos modernos:

| Logo | Terminal                   | Sistema Operativo | Protocolo      | Enlace                                          |
| :--: | :------------------------- | :---------------- | :------------- | :---------------------------------------------- |
|  🐱  | **Kitty**            | Linux / macOS     | Kitty Graphics | [Descargar](https://sw.kovidgoyal.net/kitty/)      |
|  👻  | **Ghostty**          | macOS / Linux     | Kitty Graphics | [Descargar](https://ghostty.org/)                  |
|  🐚  | **WezTerm**          | Win / Mac / Linux | Kitty / Sixel  | [Descargar](https://wezfurlong.org/wezterm/)       |
|  🍎  | **iTerm2**           | macOS             | iTerm2 Images  | [Descargar](https://iterm2.com/)                   |
|  🐧  | **Foot**             | Linux (Wayland)   | Sixel          | [Descargar](https://codeberg.org/dnkl/foot)        |
| 🖥️ | **Windows Terminal** | Windows           | Sixel (v1.22+) | [Descargar](https://github.com/microsoft/terminal) |

> * **Nota:** En terminales básicas (como CMD o la terminal de VS Code), las imágenes se renderizarán en **ASCII Art**.

---

## Desarrollo

### Estructura del proyecto

```bash
src/
├── frontend
│   ├── configutation.ts # UI del menu de configuracion
│   ├── menu.ts # UI de las secciones principales
│   ├── prompts.ts # definicion de los prompts para la UI
│   └── reader.ts # UI para el lector de capitulos
├── functions
│   ├── downloader.ts # Logica para la descarga de capitulos
│   ├── history.ts # Logica para el historial de lectura
│   └── images.ts # Logica para la carga de las paginas de los capitulos
├── index.ts # punto de entrada
├── server # las fuentes de donde se obtienen los mangas
│   └── leerCapitulo.ts # https://www.leercapitulo.co/
└── types.ts #definiciones de tipos
```

### Clonar repositorio

```bash
   git clone https://github.com/Alexandro521/yomu.git --depth=1
```

### Instalar dependencias

npm

```bash
npm install
```

Instalar navegador Firefox

```bash
npx playwright install firefox
```

Ejecutar

```bash
node run dev
```

## Funciones

* [X] Leer capitulos en terminal
* [X] Descargar capitulos en formato pdf
* [X] Historial de lectura
* [ ] Descargar multiples capitulos al mismo tiempo
* [ ] Seccion de configuracion
* [ ] Busqueda profunda
* [ ] Servidores multiples
* [ ] Notificaciones
* [ ] Seccion de Favoritos
