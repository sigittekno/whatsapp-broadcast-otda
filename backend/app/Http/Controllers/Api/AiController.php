<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\GeminiService;
use Illuminate\Http\Request;

class AiController extends Controller
{
    public function generate(Request $request, GeminiService $gemini)
    {
        $request->validate([
            'prompt' => 'required|string',
        ]);

        $result = $gemini->generateMessage($request->prompt);
        return response()->json($result);
    }
}
