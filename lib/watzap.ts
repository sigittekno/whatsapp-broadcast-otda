/**
 * Watzap.id API Utility
 */

const API_KEY = process.env.WATZAP_API_KEY || "9LTJA1PTJFH6MRIU";
const BASE_URL = process.env.WATZAP_BASE_URL || "https://api.watzap.id/v1/";

export interface WatzapResponse {
  status: "success" | "error";
  message: string;
  data?: any;
}

export async function sendWatzapMessage(
  phone: string,
  message: string,
  mediaUrl?: string,
  mediaType?: "image" | "video"
): Promise<WatzapResponse> {
  try {
    let endpoint = "send_message";
    let body: any = {
      api_key: API_KEY,
      number_key: "1", // Assuming number_key 1 is the default connected number
      phone_no: phone,
      message: message,
    };

    if (mediaUrl) {
      if (mediaType === "image") {
        endpoint = "send_image_url";
        body.url = mediaUrl;
      } else if (mediaType === "video") {
        endpoint = "send_video_url";
        body.url = mediaUrl;
      }
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Watzap API Error:", error);
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function checkWatzapStatus(): Promise<WatzapResponse> {
  try {
    const response = await fetch(`${BASE_URL}check_status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: API_KEY,
        number_key: "1",
      }),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
