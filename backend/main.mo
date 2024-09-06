import Array "mo:base/Array";
import Hash "mo:base/Hash";
import Text "mo:base/Text";

import Principal "mo:base/Principal";
import HashMap "mo:base/HashMap";
import Nat "mo:base/Nat";
import Error "mo:base/Error";
import Result "mo:base/Result";
import Iter "mo:base/Iter";

actor {
  stable var balancesEntries : [(Principal, Nat)] = [];
  var balances = HashMap.HashMap<Principal, Nat>(10, Principal.equal, Principal.hash);

  system func preupgrade() {
    balancesEntries := Iter.toArray(balances.entries());
  };

  system func postupgrade() {
    balances := HashMap.fromIter<Principal, Nat>(balancesEntries.vals(), 10, Principal.equal, Principal.hash);
    balancesEntries := [];
  };

  public shared(msg) func getBalance() : async Result.Result<Nat, Text> {
    let caller = msg.caller;
    switch (balances.get(caller)) {
      case (null) { #err("No balance found for the caller") };
      case (?balance) { #ok(balance) };
    };
  };

  public shared(msg) func setBalance(balance: Nat) : async Result.Result<(), Text> {
    let caller = msg.caller;
    balances.put(caller, balance);
    #ok(());
  };
}
