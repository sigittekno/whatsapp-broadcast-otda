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
        Schema::create('broadcasts', function (Blueprint $table) {
            $table->id();
            $table->string('author_uid'); // Firebase UID
            $table->string('title');
            $table->text('content');
            $table->string('media_url')->nullable();
            $table->enum('media_type', ['text', 'image', 'video'])->default('text');
            $table->string('category');
            $table->enum('status', ['pending', 'sending', 'completed', 'failed', 'scheduled', 'draft'])->default('pending');
            $table->integer('recipient_count')->default(0);
            $table->integer('success_count')->default(0);
            $table->integer('failed_count')->default(0);
            $table->timestamp('scheduled_at')->nullable();
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
        Schema::dropIfExists('broadcasts');
    }
};
