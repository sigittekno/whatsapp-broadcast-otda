<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\ContactListController;
use App\Http\Controllers\Api\BroadcastController;
use App\Http\Controllers\Api\AiController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| is assigned the "api" middleware group. Enjoy building your API!
|
*/

Route::prefix('v1')->group(function () {
    // Contact Lists & Recipients
    Route::get('/contact-lists', [ContactListController::class, 'index']);
    Route::post('/contact-lists', [ContactListController::class, 'store']);
    Route::get('/contact-lists/{id}', [ContactListController::class, 'show']);
    Route::delete('/contact-lists/{id}', [ContactListController::class, 'destroy']);
    
    Route::get('/contact-lists/{id}/recipients', [ContactListController::class, 'getRecipients']);
    Route::post('/contact-lists/{id}/recipients', [ContactListController::class, 'addRecipient']);
    Route::post('/contact-lists/{id}/import', [ContactListController::class, 'importCsv']);
    Route::delete('/recipients/{id}', [ContactListController::class, 'deleteRecipient']);

    // Broadcasts
    Route::get('/broadcasts', [BroadcastController::class, 'index']);
    Route::get('/broadcasts/history', [BroadcastController::class, 'history']);
    Route::post('/broadcasts', [BroadcastController::class, 'store']);
    Route::get('/broadcasts/{id}', [BroadcastController::class, 'show']);

    // AI
    Route::post('/ai/generate', [AiController::class, 'generate']);
    
    // Auth (Placeholder for generic user info)
    Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
        return $request->user();
    });
});
