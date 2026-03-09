'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Image from 'next/image';

interface ScanModalProps {
  onClose: () => void;
}

interface IdentificationResult {
  brand?: string;
  name?: string;
  format?: string;
  country?: string;
  confidence: number;
  description?: string;
}

interface Match {
  id: number;
  name: string;
  brand: string;
  price: number;
  currency: string;
  image_url?: string;
  strength?: string;
  format?: string;
  url: string;
  retailer: string;
}

export function ScanModal({ onClose }: ScanModalProps) {
  const [step, setStep] = useState<'upload' | 'scanning' | 'results'>('upload');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [identification, setIdentification] = useState<IdentificationResult | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const pendingStream = useRef<MediaStream | null>(null);

  // When cameraActive becomes true, the video element renders.
  // This callback assigns the pending stream to it.
  const videoCallbackRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && pendingStream.current) {
      node.srcObject = pendingStream.current;
      node.play().catch(() => {});
      pendingStream.current = null;
    }
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setError(null);
      // Store stream and show video element - callback ref will wire it up
      pendingStream.current = stream;
      setCameraActive(true);
    } catch (err) {
      setError('Camera access denied. Please use the upload option instead.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    setSelectedImage(imageData);
    stopCamera();
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setSelectedImage(result);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const scanCigar = async () => {
    if (!selectedImage) return;

    setStep('scanning');
    setError(null);

    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: selectedImage }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to scan cigar');
      }

      setIdentification(data.identification);
      setMatches(data.matches);
      setStep('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan cigar');
      setStep('upload');
    }
  };

  const reset = () => {
    setStep('upload');
    setSelectedImage(null);
    setIdentification(null);
    setMatches([]);
    setError(null);
    stopCamera();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0f2419] border border-[#c9a84c]/20 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="border-b border-[#c9a84c]/20 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-[#c9a84c] font-[var(--font-playfair)]">
            Scan Your Cigar
          </h2>
          <button
            onClick={onClose}
            className="text-[#8aaa7a] hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Image Preview */}
              {selectedImage && (
                <div className="text-center">
                  <div className="relative inline-block">
                    <Image
                      src={selectedImage}
                      alt="Selected cigar"
                      width={300}
                      height={300}
                      className="rounded-lg object-cover border border-[#c9a84c]/20"
                    />
                  </div>
                  <div className="mt-4 flex gap-2 justify-center">
                    <button
                      onClick={scanCigar}
                      className="bg-[#c9a84c] hover:bg-[#b8974a] text-[#0f2419] px-6 py-2 rounded-lg font-medium transition-colors"
                    >
                      🔍 Identify Cigar
                    </button>
                    <button
                      onClick={() => setSelectedImage(null)}
                      className="bg-[#1a3a2a] hover:bg-[#2a4a3a] text-white px-6 py-2 rounded-lg transition-colors"
                    >
                      Choose Different Photo
                    </button>
                  </div>
                </div>
              )}

              {/* Upload Options */}
              {!selectedImage && (
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Camera Option */}
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-white mb-4">Take Photo</h3>
                    
                    {cameraActive ? (
                      <div className="space-y-4">
                        <video
                          ref={videoCallbackRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full rounded-lg border border-[#c9a84c]/20"
                        />
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={capturePhoto}
                            className="bg-[#c9a84c] hover:bg-[#b8974a] text-[#0f2419] px-6 py-2 rounded-lg font-medium transition-colors"
                          >
                            📷 Capture
                          </button>
                          <button
                            onClick={stopCamera}
                            className="bg-[#1a3a2a] hover:bg-[#2a4a3a] text-white px-6 py-2 rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={startCamera}
                        className="w-full p-8 border-2 border-dashed border-[#c9a84c]/40 rounded-lg hover:border-[#c9a84c] transition-colors group"
                      >
                        <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">📷</div>
                        <div className="text-[#c9a84c] font-medium">Start Camera</div>
                        <div className="text-[#8aaa7a] text-sm">Take a photo of your cigar</div>
                      </button>
                    )}
                  </div>

                  {/* Upload Option */}
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-white mb-4">Upload Image</h3>
                    
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full p-8 border-2 border-dashed border-[#c9a84c]/40 rounded-lg hover:border-[#c9a84c] transition-colors group"
                    >
                      <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">📁</div>
                      <div className="text-[#c9a84c] font-medium">Choose File</div>
                      <div className="text-[#8aaa7a] text-sm">Upload from your device</div>
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400 text-center">
                  {error}
                </div>
              )}
            </div>
          )}

          {step === 'scanning' && (
            <div className="text-center py-12">
              <div className="spinner w-16 h-16 mx-auto mb-6"></div>
              <h3 className="text-xl font-semibold text-white mb-2">Analyzing your cigar...</h3>
              <p className="text-[#8aaa7a]">This may take a few seconds</p>
            </div>
          )}

          {step === 'results' && identification && (
            <div className="space-y-6">
              {/* Identification Results */}
              <div className="bg-[#1a3a2a]/80 backdrop-blur rounded-lg p-6">
                <h3 className="text-lg font-semibold text-[#c9a84c] mb-4">Identification Results</h3>
                
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    {selectedImage && (
                      <Image
                        src={selectedImage}
                        alt="Scanned cigar"
                        width={200}
                        height={200}
                        className="rounded-lg object-cover border border-[#c9a84c]/20"
                      />
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    {identification.brand && (
                      <div>
                        <span className="text-[#8aaa7a] text-sm">Brand:</span>
                        <div className="text-white font-medium">{identification.brand}</div>
                      </div>
                    )}
                    
                    {identification.name && (
                      <div>
                        <span className="text-[#8aaa7a] text-sm">Name:</span>
                        <div className="text-white font-medium">{identification.name}</div>
                      </div>
                    )}
                    
                    {identification.format && (
                      <div>
                        <span className="text-[#8aaa7a] text-sm">Format:</span>
                        <div className="text-white font-medium">{identification.format}</div>
                      </div>
                    )}
                    
                    {identification.country && (
                      <div>
                        <span className="text-[#8aaa7a] text-sm">Origin:</span>
                        <div className="text-white font-medium">{identification.country}</div>
                      </div>
                    )}
                    
                    <div>
                      <span className="text-[#8aaa7a] text-sm">Confidence:</span>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-[#0a1a10] rounded-full h-2">
                          <div 
                            className="h-2 bg-[#c9a84c] rounded-full transition-all duration-1000"
                            style={{ width: `${identification.confidence * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-[#c9a84c] font-medium">
                          {Math.round(identification.confidence * 100)}%
                        </span>
                      </div>
                    </div>
                    
                    {identification.description && (
                      <div>
                        <span className="text-[#8aaa7a] text-sm">Notes:</span>
                        <div className="text-white text-sm">{identification.description}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Matches */}
              {matches.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-[#c9a84c] mb-4">
                    Matching Products ({matches.length})
                  </h3>
                  
                  <div className="grid gap-4">
                    {matches.map((match) => (
                      <div key={match.id} className="bg-[#1a3a2a]/80 backdrop-blur rounded-lg p-4 flex gap-4">
                        <div className="w-16 h-16 bg-[#0a1a10] rounded-lg flex items-center justify-center flex-shrink-0">
                          {match.image_url ? (
                            <Image
                              src={match.image_url}
                              alt={match.name}
                              width={64}
                              height={64}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          ) : (
                            <span className="text-[#c9a84c]/30">🚬</span>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="text-[#c9a84c] text-sm font-medium">{match.brand}</div>
                          <div className="text-white font-medium truncate">{match.name}</div>
                          <div className="flex items-center gap-2 mt-1">
                            {match.strength && (
                              <span className="bg-[#0f2419] text-[#8aaa7a] px-2 py-1 rounded text-xs">
                                {match.strength}
                              </span>
                            )}
                            {match.format && (
                              <span className="bg-[#0f2419] text-[#8aaa7a] px-2 py-1 rounded text-xs">
                                {match.format}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-right flex-shrink-0">
                          <div className="text-[#c9a84c] font-bold text-lg">
                            £{match.price.toFixed(2)}
                          </div>
                          <div className="text-[#8aaa7a] text-sm">{match.retailer}</div>
                          <a
                            href={match.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block mt-1 bg-[#c9a84c] hover:bg-[#b8974a] text-[#0f2419] text-sm px-3 py-1 rounded transition-colors"
                          >
                            Buy →
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {matches.length === 0 && identification.confidence > 0 && (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2">🤔</div>
                  <h3 className="text-white font-medium mb-1">No exact matches found</h3>
                  <p className="text-[#8aaa7a] text-sm">Try browsing our catalog for similar cigars</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 justify-center pt-4">
                <button
                  onClick={reset}
                  className="bg-[#1a3a2a] hover:bg-[#2a4a3a] text-white px-6 py-2 rounded-lg transition-colors"
                >
                  Scan Another
                </button>
                <button
                  onClick={onClose}
                  className="bg-[#c9a84c] hover:bg-[#b8974a] text-[#0f2419] px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}