package system_setting

var ServerAddress = "http://localhost:3000"

// UserApiEndpoints holds the admin-configured list of API endpoints users can
// choose from on the Keys page. Raw newline-separated string; each line is
// "label|url" or just "url". Parsed on the frontend.
var UserApiEndpoints = ""

var WorkerUrl = ""
var WorkerValidKey = ""
var WorkerAllowHttpImageRequestEnabled = false

func EnableWorker() bool {
	return WorkerUrl != ""
}
