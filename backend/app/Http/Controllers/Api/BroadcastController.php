<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Broadcast;
use App\Models\Recipient;
use App\Models\BroadcastLog;
use App\Jobs\SendBroadcastJob;
use Illuminate\Http\Request;
use Carbon\Carbon;

class BroadcastController extends Controller
{
    public function index()
    {
        $broadcasts = Broadcast::orderBy('created_at', 'desc')->limit(50)->get();
        return response()->json($broadcasts);
    }

    public function store(Request $request)
    {
        $request->validate([
            'title' => 'required|string',
            'content' => 'required|string',
            'category' => 'required|string',
            'target_list_id' => 'required',
            'recipient_ids' => 'required|array',
            'media_url' => 'nullable|string',
            'media_type' => 'nullable|string',
            'scheduled_at' => 'nullable|date',
            'author_uid' => 'required|string',
            'is_draft' => 'boolean'
        ]);

        $status = $request->is_draft ? 'draft' : ($request->scheduled_at ? 'scheduled' : 'pending');

        $broadcast = Broadcast::create([
            'author_uid' => $request->author_uid,
            'title' => $request->title,
            'content' => $request->content,
            'media_url' => $request->media_url,
            'media_type' => $request->media_type ?? 'text',
            'category' => $request->category,
            'status' => $status,
            'recipient_count' => count($request->recipient_ids),
            'scheduled_at' => $request->scheduled_at ? Carbon::parse($request->scheduled_at) : null,
        ]);

        if ($status === 'pending') {
            // Immediately start sending
            $broadcast->update(['status' => 'sending']);
            
            $recipients = Recipient::whereIn('id', $request->recipient_ids)->get();
            foreach ($recipients as $recipient) {
                SendBroadcastJob::dispatch($broadcast, $recipient);
            }
        }

        return response()->json($broadcast, 201);
    }

    public function show($id)
    {
        $broadcast = Broadcast::with(['logs' => function($q) {
            $q->orderBy('sent_at', 'desc')->limit(100);
        }])->findOrFail($id);
        
        return response()->json($broadcast);
    }

    public function history()
    {
        $broadcasts = Broadcast::orderBy('created_at', 'desc')->get();
        return response()->json($broadcasts);
    }
}
