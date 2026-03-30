<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class GeminiService {
    protected $apiKey;
    protected $baseUrl;

    public function __construct() {
        $this->apiKey = config('services.gemini.key');
        $this->baseUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent";
    }

    public function generateMessage($prompt) {
        if (!$this->apiKey) {
            return [
                'status' => 'error',
                'message' => 'Gemini API key is not configured.'
            ];
        }

        try {
            $response = Http::post($this->baseUrl . "?key=" . $this->apiKey, [
                "contents" => [
                    [
                        "parts" => [
                            ["text" => $prompt]
                        ]
                    ]
                ]
            ]);

            $result = $response->json();
            
            if (isset($result['candidates'][0]['content']['parts'][0]['text'])) {
                return [
                    'status' => 'success',
                    'text' => $result['candidates'][0]['content']['parts'][0]['text']
                ];
            }

            return [
                'status' => 'error',
                'message' => 'Failed to generate content: ' . json_encode($result)
            ];

        } catch (\Exception $e) {
            return [
                'status' => 'error',
                'message' => $e->getMessage()
            ];
        }
    }
}
