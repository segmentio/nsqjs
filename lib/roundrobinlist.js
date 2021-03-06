// Generated by CoffeeScript 1.6.3
/*
Takes a list and cycles through the elements in the list repeatedly and
in-order. Adding and removing to the list does not perturb the order.

Usage:
  lst = RoundRobinList [1, 2, 3]
  lst.next()                      # Returns [1]
  lst.next 2                      # Returns [2, 3]
  lst.next 2                      # Returns [1, 2]
  lst.add 5
  lst.next 2                      # Retunrs [3, 5]
*/

var RoundRobinList;

RoundRobinList = (function() {
  function RoundRobinList(lst) {
    this.lst = lst.slice(0);
    this.index = 0;
  }

  RoundRobinList.prototype.length = function() {
    return this.lst.length;
  };

  RoundRobinList.prototype.add = function(item) {
    return this.lst.push(item);
  };

  RoundRobinList.prototype.remove = function(item) {
    var itemIndex;
    itemIndex = this.lst.indexOf(item);
    if (itemIndex === -1) {
      return;
    }
    if (this.index > itemIndex) {
      this.index -= 1;
    }
    return this.lst.splice(itemIndex, 1);
  };

  RoundRobinList.prototype.next = function(count) {
    var index;
    if (count == null) {
      count = 1;
    }
    index = this.index;
    this.index = (this.index + count) % this.lst.length;
    return this.lst.slice(index, index + count);
  };

  return RoundRobinList;

})();

module.exports = RoundRobinList;
