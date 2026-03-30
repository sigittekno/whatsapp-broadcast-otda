<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Recipient extends Model
{
    use HasFactory;

    protected $fillable = ['contact_list_id', 'name', 'phone', 'region'];

    public function contactList()
    {
        return $this->belongsTo(ContactList::class);
    }
}
