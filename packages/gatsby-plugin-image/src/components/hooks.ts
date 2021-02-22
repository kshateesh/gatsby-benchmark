/* eslint-disable no-unused-expressions */
import {
  useState,
  CSSProperties,
  useEffect,
  HTMLAttributes,
  ImgHTMLAttributes,
  ReactEventHandler,
  SetStateAction,
  Dispatch,
  RefObject,
} from "react"
import { Node } from "gatsby"
import { PlaceholderProps } from "./placeholder"
import { MainImageProps } from "./main-image"
import type { IGatsbyImageData } from "./gatsby-image.browser"
import {
  IGatsbyImageHelperArgs,
  generateImageData,
  Layout,
  EVERY_BREAKPOINT,
  IImage,
  ImageFormat,
} from "../image-utils"
const imageCache = new Set<string>()

// Native lazy-loading support: https://addyosmani.com/blog/lazy-loading/
export const hasNativeLazyLoadSupport = (): boolean =>
  typeof HTMLImageElement !== `undefined` &&
  `loading` in HTMLImageElement.prototype

export function storeImageloaded(cacheKey?: string): void {
  if (cacheKey) {
    imageCache.add(cacheKey)
  }
}

export function hasImageLoaded(cacheKey: string): boolean {
  return imageCache.has(cacheKey)
}

export type FileNode = Node & {
  childImageSharp?: Node & {
    gatsbyImageData?: IGatsbyImageData
  }
}

export const getImage = (file: FileNode): IGatsbyImageData | undefined =>
  file?.childImageSharp?.gatsbyImageData

export const getSrc = (file: FileNode): string | undefined =>
  file?.childImageSharp?.gatsbyImageData?.images?.fallback?.src

export function getWrapperProps(
  width: number,
  height: number,
  layout: Layout
): Pick<HTMLAttributes<HTMLElement>, "className" | "style"> & {
  "data-gatsby-image-wrapper": string
} {
  const wrapperStyle: CSSProperties = {}

  let className = `gatsby-image-wrapper`

  // If the plugin isn't installed we need to apply the styles inline
  if (!global.GATSBY___IMAGE) {
    wrapperStyle.position = `relative`
    wrapperStyle.overflow = `hidden`
  }

  if (layout === `fixed`) {
    wrapperStyle.width = width
    wrapperStyle.height = height
  } else if (layout === `constrained`) {
    if (!global.GATSBY___IMAGE) {
      wrapperStyle.display = `inline-block`
    }
    className = `gatsby-image-wrapper gatsby-image-wrapper-constrained`
  }

  return {
    className,
    "data-gatsby-image-wrapper": ``,
    style: wrapperStyle,
  }
}

export async function applyPolyfill(
  ref: RefObject<HTMLImageElement>
): Promise<void> {
  if (!(`objectFitPolyfill` in window)) {
    await import(
      /* webpackChunkName: "gatsby-plugin-image-objectfit-polyfill" */ `objectFitPolyfill`
    )
  }
  ;(window as any).objectFitPolyfill(ref.current)
}

export interface IUrlBuilderArgs<OptionsType> {
  width: number
  height: number
  baseUrl: string
  format: ImageFormat
  options: OptionsType
}
export interface IGetImageDataArgs<OptionsType = {}> {
  baseUrl: string
  /**
   * For constrained and fixed images, the size of the image element
   */
  width?: number
  height?: number
  /**
   * If available, pass the source image width and height
   */
  sourceWidth?: number
  sourceHeight?: number
  /**
   * If only one dimension is passed, then this will be used to calculate the other.
   */
  aspectRatio?: number
  layout?: Layout
  /**
   * Returns a URL based on the passed arguments. Should be a pure function
   */
  urlBuilder: (args: IUrlBuilderArgs<OptionsType>) => string

  /**
   * Should be a data URI
   */
  placeholderURL?: string
  backgroundColor?: string
  /**
   * Used in error messages etc
   */
  pluginName?: string

  /**
   * If you do not support auto-format, pass an array of image types here
   */
  formats?: Array<ImageFormat>

  breakpoints?: Array<number>

  /**
   * Passed to the urlBuilder function
   */
  options?: OptionsType
}

/**
 * Use this hook to generate gatsby-plugin-image data in the browser.
 */
export function getImageData<OptionsType>({
  baseUrl,
  urlBuilder,
  sourceWidth,
  sourceHeight,
  pluginName = `useGatsbyImage`,
  formats = [`auto`],
  breakpoints = EVERY_BREAKPOINT,
  options,
  ...props
}: IGetImageDataArgs<OptionsType>): IGatsbyImageData {
  const generateImageSource = (
    baseUrl: string,
    width: number,
    height?: number,
    format?: ImageFormat
  ): IImage => {
    return {
      width,
      height,
      format,
      src: urlBuilder({ baseUrl, width, height, options, format }),
    }
  }

  const sourceMetadata: IGatsbyImageHelperArgs["sourceMetadata"] = {
    width: sourceWidth,
    height: sourceHeight,
    format: `auto`,
  }

  const args: IGatsbyImageHelperArgs = {
    ...props,
    pluginName,
    generateImageSource,
    filename: baseUrl,
    formats,
    breakpoints,
    sourceMetadata,
  }
  return generateImageData(args)
}

export function getMainProps(
  isLoading: boolean,
  isLoaded: boolean,
  images: IGatsbyImageData["images"],
  loading?: "eager" | "lazy",
  toggleLoaded?: (loaded: boolean) => void,
  cacheKey?: string,
  ref?: RefObject<HTMLImageElement>,
  style: CSSProperties = {}
): Partial<MainImageProps> {
  const onLoad: ReactEventHandler<HTMLImageElement> = function (e) {
    if (isLoaded) {
      return
    }

    storeImageloaded(cacheKey)

    const target = e.currentTarget
    const img = new Image()
    img.src = target.currentSrc

    if (img.decode) {
      // Decode the image through javascript to support our transition
      img
        .decode()
        .catch(() => {
          // ignore error, we just go forward
        })
        .then(() => {
          toggleLoaded(true)
        })
    } else {
      toggleLoaded(true)
    }
  }

  // Polyfill "object-fit" if unsupported (mostly IE)
  if (ref?.current && !(`objectFit` in document.documentElement.style)) {
    ref.current.dataset.objectFit = style.objectFit ?? `cover`
    ref.current.dataset.objectPosition = `${style.objectPosition ?? `50% 50%`}`
    applyPolyfill(ref)
  }

  // fallback when it's not configured in gatsby-config.
  if (!global.GATSBY___IMAGE) {
    style = {
      height: `100%`,
      left: 0,
      position: `absolute`,
      top: 0,
      transform: `translateZ(0)`,
      transition: `opacity 250ms linear`,
      width: `100%`,
      willChange: `opacity`,
      ...style,
    }
  }

  const result = {
    ...images,
    loading,
    shouldLoad: isLoading,
    "data-main-image": ``,
    style: {
      ...style,
      opacity: isLoaded ? 1 : 0,
    },
    onLoad,
    ref,
  }

  return result
}

export type PlaceholderImageAttrs = ImgHTMLAttributes<HTMLImageElement> &
  Pick<PlaceholderProps, "sources" | "fallback"> & {
    "data-placeholder-image"?: string
  }

export function getPlaceholderProps(
  placeholder: PlaceholderImageAttrs | undefined,
  isLoaded: boolean,
  layout: Layout,
  width?: number,
  height?: number,
  backgroundColor?: string
): PlaceholderImageAttrs {
  const wrapperStyle: CSSProperties = {}

  if (backgroundColor) {
    wrapperStyle.backgroundColor = backgroundColor

    if (layout === `fixed`) {
      wrapperStyle.width = width
      wrapperStyle.height = height
      wrapperStyle.backgroundColor = backgroundColor
      wrapperStyle.position = `relative`
    } else if (layout === `constrained`) {
      wrapperStyle.position = `absolute`
      wrapperStyle.top = 0
      wrapperStyle.left = 0
      wrapperStyle.bottom = 0
      wrapperStyle.right = 0
    } else if (layout === `fullWidth`) {
      wrapperStyle.position = `absolute`
      wrapperStyle.top = 0
      wrapperStyle.left = 0
      wrapperStyle.bottom = 0
      wrapperStyle.right = 0
    }
  }

  const result: PlaceholderImageAttrs = {
    ...placeholder,
    "aria-hidden": true,
    "data-placeholder-image": ``,
    style: {
      opacity: isLoaded ? 0 : 1,
      transition: `opacity 500ms linear`,
      ...wrapperStyle,
    },
  }

  // fallback when it's not configured in gatsby-config.
  if (!global.GATSBY___IMAGE) {
    result.style = {
      height: `100%`,
      left: 0,
      position: `absolute`,
      top: 0,
      width: `100%`,
    }
  }

  return result
}

export function useImageLoaded(
  cacheKey: string,
  loading: "lazy" | "eager",
  ref: any
): {
  isLoaded: boolean
  isLoading: boolean
  toggleLoaded: Dispatch<SetStateAction<boolean>>
} {
  const [isLoaded, toggleLoaded] = useState(false)
  const [isLoading, toggleIsLoading] = useState(loading === `eager`)

  const rAF =
    typeof window !== `undefined` && `requestAnimationFrame` in window
      ? requestAnimationFrame
      : function (cb: TimerHandler): number {
          return setTimeout(cb, 16)
        }
  const cRAF =
    typeof window !== `undefined` && `cancelAnimationFrame` in window
      ? cancelAnimationFrame
      : clearTimeout

  useEffect(() => {
    let interval: number
    // @see https://stackoverflow.com/questions/44074747/componentdidmount-called-before-ref-callback/50019873#50019873
    function toggleIfRefExists(): void {
      if (ref.current) {
        if (loading === `eager` && ref.current.complete) {
          storeImageloaded(cacheKey)
          toggleLoaded(true)
        } else {
          toggleIsLoading(true)
        }
      } else {
        interval = rAF(toggleIfRefExists)
      }
    }
    toggleIfRefExists()

    return (): void => {
      cRAF(interval)
    }
  }, [])

  return {
    isLoading,
    isLoaded,
    toggleLoaded,
  }
}

export interface IArtDirectedImage {
  media: string
  image: IGatsbyImageData
}

/**
 * Generate a Gatsby image data object with multiple, art-directed images that display at different
 * resolutions.
 *
 * @param defaultImage The image displayed when no media query matches.
 * It is also used for all other settings applied to the image, such as width, height and layout.
 * You should pass a className to the component with media queries to adjust the size of the container,
 * as this cannot be adjusted automatically.
 * @param artDirected Array of objects which each contains a `media` string which is a media query
 * such as `(min-width: 320px)`, and the image object to use when that query matches.
 */
export function withArtDirection(
  defaultImage: IGatsbyImageData,
  artDirected: Array<IArtDirectedImage>
): IGatsbyImageData {
  const { images, placeholder, ...props } = defaultImage
  const output: IGatsbyImageData = {
    ...props,
    images: {
      ...images,
      sources: [],
    },
    placeholder: placeholder && {
      ...placeholder,
      sources: [],
    },
  }

  artDirected.forEach(({ media, image }) => {
    if (!media) {
      if (process.env.NODE_ENV === `development`) {
        console.warn(
          "[gatsby-plugin-image] All art-directed images passed to must have a value set for `media`. Skipping."
        )
      }
      return
    }

    if (
      image.layout !== defaultImage.layout &&
      process.env.NODE_ENV === `development`
    ) {
      console.warn(
        `[gatsby-plugin-image] Mismatched image layout: expected "${defaultImage.layout}" but received "${image.layout}". All art-directed images use the same layout as the default image`
      )
    }

    output.images.sources.push(
      ...image.images.sources.map(source => {
        return { ...source, media }
      }),
      {
        media,
        srcSet: image.images.fallback.srcSet,
      }
    )

    if (!output.placeholder) {
      return
    }

    output.placeholder.sources.push({
      media,
      srcSet: image.placeholder.fallback,
    })
  })
  output.images.sources.push(...images.sources)
  if (placeholder?.sources) {
    output.placeholder?.sources.push(...placeholder.sources)
  }
  return output
}
