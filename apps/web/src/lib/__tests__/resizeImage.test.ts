import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  computeTargetSize,
  resizeImageForUpload,
  imageUploadFormData,
  MAX_ORIGINAL_UPLOAD_BYTES,
  PHOTO_TOO_LARGE_MESSAGE,
} from '../client/resizeImage';

describe('computeTargetSize', () => {
  it('scales a landscape image to a 1600 px long edge', () => {
    expect(computeTargetSize(6000, 4000, 1600)).toEqual({ width: 1600, height: 1067 });
  });

  it('scales a portrait image to a 1600 px long edge', () => {
    expect(computeTargetSize(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it('scales a square image', () => {
    expect(computeTargetSize(4000, 4000, 1600)).toEqual({ width: 1600, height: 1600 });
  });

  it('never upscales an image that is already small enough', () => {
    expect(computeTargetSize(1200, 800, 1600)).toEqual({ width: 1200, height: 800 });
    expect(computeTargetSize(1600, 900, 1600)).toEqual({ width: 1600, height: 900 });
  });

  it('keeps a very thin image at least 1 px wide', () => {
    expect(computeTargetSize(10000, 2, 1600)).toEqual({ width: 1600, height: 1 });
  });
});

function photo(bytes: number, name = 'IMG_1234.HEIC', type = 'image/heic') {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe('resizeImageForUpload', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('draws a large photo onto a 1600 px canvas and returns a JPEG named .jpg', async () => {
    const close = vi.fn();
    const decode = vi.fn().mockResolvedValue({ width: 6000, height: 4000, close });
    vi.stubGlobal('createImageBitmap', decode);
    const context = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never);
    const toBlob = vi
      .spyOn(HTMLCanvasElement.prototype, 'toBlob')
      .mockImplementation(function (this: HTMLCanvasElement, callback) {
        callback(new Blob([new Uint8Array(300_000)], { type: 'image/jpeg' }));
      });

    const result = await resizeImageForUpload(photo(5_000_000, 'IMG_1234.JPG', 'image/jpeg'));

    expect(result.name).toBe('IMG_1234.jpg');
    expect(result.type).toBe('image/jpeg');
    expect(result.size).toBe(300_000);
    expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1600, 1067);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.8);
    const canvas = toBlob.mock.contexts[0] as HTMLCanvasElement;
    expect([canvas.width, canvas.height]).toEqual([1600, 1067]);
    expect(close).toHaveBeenCalled();
    // EXIF is lost on re-encode, so orientation must be applied at decode.
    expect(decode).toHaveBeenCalledWith(expect.any(File), { imageOrientation: 'from-image' });
  });

  it('sends the original when the browser cannot decode it and it is at most 4 MB', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new DOMException('unsupported', 'InvalidStateError')));
    const original = photo(MAX_ORIGINAL_UPLOAD_BYTES);
    await expect(resizeImageForUpload(original)).resolves.toBe(original);
  });

  it.each([
    ['IMG_1.HEIC', 'image/heic'],
    ['scan.heif', 'image/heif'],
    ['photo.JPG', 'image/jpeg'],
  ])('gives an untyped fallback original (%s) its image type from the extension', async (name, type) => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('no decoder')));
    const result = await resizeImageForUpload(photo(1000, name, ''));
    expect(result.type).toBe(type);
    expect(result.name).toBe(name);
  });

  it('leaves an untyped original with an unknown extension as it is', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('no decoder')));
    const original = photo(1000, 'mystery.bin', '');
    await expect(resizeImageForUpload(original)).resolves.toBe(original);
  });

  it('refuses an undecodable photo over 4 MB with the friendly message', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new DOMException('unsupported', 'InvalidStateError')));
    await expect(resizeImageForUpload(photo(MAX_ORIGINAL_UPLOAD_BYTES + 1))).rejects.toMatchObject({
      name: 'PhotoTooLargeError',
      message: PHOTO_TOO_LARGE_MESSAGE,
    });
  });

  it('falls back the same way when the JPEG export fails', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 4000, height: 3000, close: vi.fn() }));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() } as never
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(null));
    const original = photo(1_000_000, 'small.png', 'image/png');
    await expect(resizeImageForUpload(original)).resolves.toBe(original);
  });

  it('wraps the result as the multipart image field', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('no decoder')));
    const original = photo(1000, 'pantry.webp', 'image/webp');
    const formData = await imageUploadFormData(original);
    const image = formData.get('image');
    expect(image).toBeInstanceOf(File);
    expect((image as File).name).toBe('pantry.webp');
  });
});
