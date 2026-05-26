import AppKit
import Foundation
import PDFKit

struct GuideExtractionConfig {
  let pdfPath: String
  let pagesDirectory: String
  let montagePath: String
  let pageSize: NSSize
  let thumbSize: NSSize
  let montageColumns: Int
  let montageRows: Int
  let montageGutter: CGFloat
}

func argumentValue(_ name: String, default defaultValue: String) -> String {
  let args = CommandLine.arguments
  if let index = args.firstIndex(of: name), index + 1 < args.count {
    return args[index + 1]
  }
  return defaultValue
}

func writePng(_ bitmap: NSBitmapImageRep, to path: String) throws {
  guard let png = bitmap.representation(using: .png, properties: [:]) else {
    throw NSError(
      domain: "KayKitGuideExtraction",
      code: 1,
      userInfo: [NSLocalizedDescriptionKey: "Unable to encode PNG for \(path)"]
    )
  }

  try png.write(to: URL(fileURLWithPath: path), options: .atomic)
}

func makeBitmap(width: Int, height: Int) -> NSBitmapImageRep {
  guard
    let bitmap = NSBitmapImageRep(
      bitmapDataPlanes: nil,
      pixelsWide: width,
      pixelsHigh: height,
      bitsPerSample: 8,
      samplesPerPixel: 4,
      hasAlpha: true,
      isPlanar: false,
      colorSpaceName: .deviceRGB,
      bytesPerRow: 0,
      bitsPerPixel: 0
    )
  else {
    fatalError("Unable to create bitmap \(width)x\(height)")
  }
  return bitmap
}

func renderPage(_ page: PDFPage, size: NSSize) -> NSBitmapImageRep {
  let bitmap = makeBitmap(width: Int(size.width), height: Int(size.height))
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
  NSColor.white.setFill()
  NSRect(origin: .zero, size: size).fill()

  guard let context = NSGraphicsContext.current?.cgContext else {
    NSGraphicsContext.restoreGraphicsState()
    return bitmap
  }

  let bounds = page.bounds(for: .mediaBox)
  context.saveGState()
  context.scaleBy(x: size.width / bounds.width, y: size.height / bounds.height)
  page.draw(with: .mediaBox, to: context)
  context.restoreGState()
  NSGraphicsContext.restoreGraphicsState()
  return bitmap
}

func makeMontage(pagePaths: [String], config: GuideExtractionConfig) throws {
  let width = CGFloat(config.montageColumns) * (config.thumbSize.width + config.montageGutter)
    + config.montageGutter
  let height = CGFloat(config.montageRows) * (config.thumbSize.height + config.montageGutter)
    + config.montageGutter
  let canvas = makeBitmap(width: Int(width), height: Int(height))
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: canvas)
  NSColor(calibratedWhite: 0.13, alpha: 1).setFill()
  NSRect(x: 0, y: 0, width: width, height: height).fill()

  for (index, pagePath) in pagePaths.enumerated() {
    guard let pageImage = NSImage(contentsOfFile: pagePath) else {
      continue
    }
    let column = index % config.montageColumns
    let row = index / config.montageColumns
    let x = config.montageGutter + CGFloat(column) * (config.thumbSize.width + config.montageGutter)
    let yFromTop = config.montageGutter + CGFloat(row) * (config.thumbSize.height + config.montageGutter)
    let y = height - yFromTop - config.thumbSize.height
    pageImage.draw(
      in: NSRect(origin: NSPoint(x: x, y: y), size: config.thumbSize),
      from: NSRect(origin: .zero, size: pageImage.size),
      operation: .copy,
      fraction: 1
    )
  }

  NSGraphicsContext.restoreGraphicsState()
  try writePng(canvas, to: config.montagePath)
}

let fileManager = FileManager.default
let repoRoot = fileManager.currentDirectoryPath
let config = GuideExtractionConfig(
  pdfPath: argumentValue(
    "--pdf",
    default: "\(repoRoot)/references/KayKit_Medieval_Hexagon_Pack_1.0_FREE/Medieval_Hexagon_UserGuide_v1.pdf"
  ),
  pagesDirectory: argumentValue(
    "--pages",
    default: "\(repoRoot)/docs/assets/kaykit-guide/pages"
  ),
  montagePath: argumentValue(
    "--montage",
    default: "\(repoRoot)/docs/assets/kaykit-guide/montage.png"
  ),
  pageSize: NSSize(width: 1920, height: 1080),
  thumbSize: NSSize(width: 480, height: 270),
  montageColumns: 4,
  montageRows: 5,
  montageGutter: 8
)

try fileManager.createDirectory(
  atPath: config.pagesDirectory,
  withIntermediateDirectories: true,
  attributes: nil
)
try fileManager.createDirectory(
  atPath: URL(fileURLWithPath: config.montagePath).deletingLastPathComponent().path,
  withIntermediateDirectories: true,
  attributes: nil
)

guard let document = PDFDocument(url: URL(fileURLWithPath: config.pdfPath)) else {
  fputs("Unable to open PDF at \(config.pdfPath)\n", stderr)
  exit(1)
}

var pagePaths: [String] = []
for index in 0..<document.pageCount {
  guard let page = document.page(at: index) else {
    continue
  }
  let rendered = renderPage(page, size: config.pageSize)
  let pagePath = "\(config.pagesDirectory)/page-\(String(format: "%02d", index + 1)).png"
  try writePng(rendered, to: pagePath)
  pagePaths.append(pagePath)
}

try makeMontage(pagePaths: pagePaths, config: config)
print("Extracted \(pagePaths.count) guide pages and montage.")
