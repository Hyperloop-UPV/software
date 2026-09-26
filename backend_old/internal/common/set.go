package common

type Set[T comparable] struct {
	set map[T]struct{}
}

func NewSet[T comparable]() Set[T] {
	return Set[T]{
		set: make(map[T]struct{}),
	}
}

func (set *Set[T]) Add(item T) {
	set.set[item] = struct{}{}
}

func (set *Set[T]) Remove(item T) {
	delete(set.set, item)
}

func (set *Set[T]) Has(item T) bool {
	_, ok := set.set[item]
	return ok
}

func (set *Set[T]) ForEach(callback func(item T)) {
	for item := range set.set {
		callback(item)
	}
}

func (set *Set[T]) AsSlice() []T {
	slice := make([]T, 0, len(set.set))
	for item := range set.set {
		slice = append(slice, item)
	}
	return slice
}
