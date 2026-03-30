<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ContactList;
use App\Models\Recipient;
use Illuminate\Http\Request;

class ContactListController extends Controller
{
    public function index()
    {
        return response()->json(ContactList::all());
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string',
            'description' => 'nullable|string',
        ]);

        $list = ContactList::create($request->all());
        return response()->json($list, 201);
    }

    public function show($id)
    {
        $list = ContactList::with('recipients')->findOrFail($id);
        return response()->json($list);
    }

    public function destroy($id)
    {
        ContactList::destroy($id);
        return response()->json(['message' => 'List deleted successfully']);
    }

    public function getRecipients($id)
    {
        $recipients = Recipient::where('contact_list_id', $id)->orderBy('created_at', 'desc')->get();
        return response()->json($recipients);
    }

    public function addRecipient(Request $request, $id)
    {
        $request->validate([
            'name' => 'required|string',
            'phone' => 'required|string',
            'region' => 'nullable|string',
        ]);

        $recipient = Recipient::create([
            'contact_list_id' => $id,
            'name' => $request->name,
            'phone' => $request->phone,
            'region' => $request->region,
        ]);

        return response()->json($recipient, 201);
    }

    public function deleteRecipient($id)
    {
        Recipient::destroy($id);
        return response()->json(['message' => 'Recipient deleted successfully']);
    }

    public function importCsv(Request $request, $id)
    {
        $request->validate([
            'recipients' => 'required|array',
            'recipients.*.name' => 'required|string',
            'recipients.*.phone' => 'required|string',
        ]);

        $list = ContactList::findOrFail($id);
        $count = 0;

        foreach ($request->recipients as $item) {
            Recipient::create([
                'contact_list_id' => $id,
                'name' => $item['name'],
                'phone' => $item['phone'],
                'region' => $item['region'] ?? null,
            ]);
            $count++;
        }

        return response()->json(['message' => "$count recipients imported successfully"]);
    }
}
