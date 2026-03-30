<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Broadcast extends Model
{
    use HasFactory;

    protected $fillable = [
        'author_uid', 'title', 'content', 'media_url', 'media_type', 
        'category', 'status', 'recipient_count', 'success_count', 
        'failed_count', 'scheduled_at'
    ];

    protected $casts = [
        'scheduled_at' => 'datetime',
    ];

    public function logs()
    {
        return $this->hasMany(BroadcastLog::class);
    }
}
