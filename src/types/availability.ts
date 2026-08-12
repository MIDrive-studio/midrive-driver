export type AvailabilityRequest = {
  id: string;
  site_id: string;
  date_from: string;
  date_to: string;
  status: "open" | "closed";
};

export type AvailabilitySubmission = {
  id: string;
  driver_id: string;
  request_id: string;
  date: string;
  status: "in" | "off";
};

export type AvailabilityStatusResponse = {
  data: {
    activeRequest: AvailabilityRequest | null;
    closedRequests: AvailabilityRequest[];
    mySubmissions: AvailabilitySubmission[];
    daysOffAvailableMap: Record<string, number>;
  };
};

export type SubmissionInput = { date: string; status: "in" | "off" };

export type SubmissionResult = {
  date: string;
  status: "accepted" | "rejected";
  reason?: string;
  finalStatus?: "in" | "off";
};

export type AvailabilitySubmitResponse = {
  results: SubmissionResult[];
};
