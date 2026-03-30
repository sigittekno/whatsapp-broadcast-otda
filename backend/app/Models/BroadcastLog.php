<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BroadcastLog extends Model
{
    use HasFactory;

    protected $fillable = ['broadcast_id', 'recipient_phone', 'status', 'error_message', 'sent_at'];

    protected $casts = [
        'sent_at' => 'datetime',
    ];

    public function broadcast()
    {
        return $this->belongsTo(Broadcast::class);
    }
}
