<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class WatzapService {
    protected $apiKey;
    protected $baseUrl;
    protected $numberKey;

    public function __construct() {
        $this->apiKey = config('services.watzap.api_key');
        $this->baseUrl = config('services.watzap.base_url', 'https://api.watzap.id/v1/');
        $this->numberKey = config('services.watzap.number_key', '1');
    }

    public function sendMessage($phone, $message, $mediaUrl = null, $mediaType = null) {
        $endpoint = "send_message";
        $payload = [
            'api_key' => $this->apiKey,
            'number_key' => $this->numberKey,
            'phone_no' => $phone,
            'message' => $message,
        ];

        if ($mediaUrl) {
            if ($mediaType === 'image') {
                $endpoint = "send_image_url";
                $payload['url'] = $mediaUrl;
            } elseif ($mediaType === 'video') {
                $endpoint = "send_video_url";
                $payload['url'] = $mediaUrl;
            }
        }

        try {
            $response = Http::post($this->baseUrl . $endpoint, $payload);
            return $response->json();
        } catch (\Exception $e) {
            return [
                'status' => 'error',
                'message' => $e->getMessage()
            ];
        }
    }
}
