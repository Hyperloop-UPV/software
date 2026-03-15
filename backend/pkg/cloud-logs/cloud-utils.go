package cloud_logs

type Logs struct {
	Count int    `json:"count"`
	Logs  []File `json:"logs"`
}

type File struct {
	Id           int    `json:"id"`
	Filename     string `json:"filename"`
	Content_type string `json:"content:type"`
	Size_bytes   int    `json:"size_bytes"`
}

type Filepath struct {
	Path string `json:"filepath"`
}

type Token struct {
	Token string `json:"access_token"`
}

type Logins struct {
	Password string `json:"password"`
}
