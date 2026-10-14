package common

import "fmt"

type StackError struct {
	err   error
	stack [][2]string
}

func NewStackError(err error) StackError {
	return StackError{
		err:   err,
		stack: make([][2]string, 0),
	}
}

func (err *StackError) AddStackEntry(key string, value string) {
	err.stack = append(err.stack, [2]string{key, value})
}

func (err StackError) Error() string {
	errString := err.err.Error()

	for _, entry := range err.stack {
		entryString := fmt.Sprintf("@%s\t%s\n", entry[0], entry[1])
		errString += entryString
	}

	return errString
}

type ErrorList []error

func NewErrorList() ErrorList {
	return make(ErrorList, 0)
}

func (err ErrorList) Add(adeErr error) {
	err = append(err, adeErr)
}

func (err ErrorList) Error() string {
	errString := ""

	for _, someErr := range err {
		errString = fmt.Sprintf("%s%s", errString, someErr.Error())
	}

	return errString
}
