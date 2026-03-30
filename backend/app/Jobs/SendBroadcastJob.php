<?php

namespace App\Jobs;

use App\Models\Broadcast;
use App\Models\Recipient;
use App\Models\BroadcastLog;
use App\Services\WatzapService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendBroadcastJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected $broadcast;
    protected $recipient;

    /**
     * Create a new job instance.
     *
     * @return void
     */
    public function __construct(Broadcast $broadcast, Recipient $recipient)
    {
        $this->broadcast = $broadcast;
        $this->recipient = $recipient;
    }

    /**
     * Execute the job.
     *
     * @return void
     */
    public function handle(WatzapService $watzap)
    {
        // Optional: Add a small delay to avoid rate limiting
        // usleep(500000); // 0.5 seconds

        $response = $watzap->sendMessage(
            $this->recipient->phone,
            $this->broadcast->content,
            $this->broadcast->media_url,
            $this->broadcast->media_type
        );

        $status = null;
        if (isset($response['status'])) {
            $status = ($response['status'] === 'success') ? 'success' : 'failed';
        } else {
            $status = 'failed';
        }
        
        $errorMessage = ($status === 'failed') ? ($response['message'] ?? 'Unknown error response from API') : null;

        // Log the result
        BroadcastLog::create([
            'broadcast_id' => $this->broadcast->id,
            'recipient_phone' => $this->recipient->phone,
            'status' => $status,
            'error_message' => $errorMessage,
            'sent_at' => now(),
        ]);

        // Update broadcast counts atomically
        if ($status === 'success') {
            $this->broadcast->increment('success_count');
        } else {
            $this->broadcast->increment('failed_count');
        }

        // Final check to mark as completed
        $totalProcessed = $this->broadcast->success_count + $this->broadcast->failed_count;
        if ($totalProcessed >= $this->broadcast->recipient_count) {
            $this->broadcast->update(['status' => 'completed']);
        }
    }
}
