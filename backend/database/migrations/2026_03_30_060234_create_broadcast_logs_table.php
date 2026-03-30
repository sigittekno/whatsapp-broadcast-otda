<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('broadcast_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('broadcast_id')->constrained('broadcasts')->onDelete('cascade');
            $table->string('recipient_phone');
            $table->enum('status', ['success', 'failed']);
            $table->text('error_message')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('broadcast_logs');
    }
};
