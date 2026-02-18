package main

type envError struct {
	msg string
}

func (e *envError) Error() string {
	return e.msg
}
